# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["numpy>=2", "pandas>=2.2", "pyarrow>=15", "torch==2.8.0", "stable-baselines3==2.9.0"]
# ///
"""Converts a results folder of the training notebook (cadence_hvac_dqn_ddqn_ppo.ipynb) into a dashboard bundle.

The notebook does not log per-action scores, so they are rebuilt offline: each decision's observation is recomputed
from the logged 15-minute records (the notebook's CadenceObservationWrapper) and passed through the saved model with
its frozen VecNormalize statistics. No simulation is re-run, and EnergyPlus is not needed.

    uv run tools/import_results.py path/to/results/cadence_v3      # -> public/bundles/cadence_v3

Checks before anything is written: the reward terms add up to the logged reward, the metrics match
evaluation_metrics.csv, every agent's logged action is its highest-scoring one, and the chosen-action Q-values match the
notebook's q_estimates files where they exist. A failure means the traces and the models are not from the same run.
"""

from __future__ import annotations

import argparse
import json
import pickle
from collections.abc import Callable
from functools import lru_cache
from pathlib import Path
from typing import Any, Final

import numpy as np
import numpy.typing as npt
import pandas as pd
import torch
import torch.nn as nn
from stable_baselines3 import DQN, PPO
from stable_baselines3.common.base_class import BaseAlgorithm
from stable_baselines3.common.torch_layers import BaseFeaturesExtractor

import cadence_bundle as cb

# Notebook constants (cells 3, 4 and 6). They are not stored in the results folder.
CLIMATES: Final[tuple[str, ...]] = ("hot", "mixed", "cool")
TRAIN_CLIMATE: Final[str] = "mixed"
EVAL_ENV_IDS: Final[dict[str, str]] = {climate: f"Eplus-5zone-{climate}-discrete-v1" for climate in CLIMATES}
TIMESTEPS_PER_HOUR: Final[int] = 4
ACTION_REPEAT: Final[int] = TIMESTEPS_PER_HOUR
OPERATING_HOURS: Final[tuple[int, int]] = (8, 18)
WORKDAYS: Final[frozenset[int]] = frozenset({2, 3, 4, 5, 6})

COMFORT_WINTER: Final[tuple[float, float]] = (20.0, 23.5)
COMFORT_SUMMER: Final[tuple[float, float]] = (23.0, 26.0)
SUMMER_START: Final[tuple[int, int]] = (6, 1)
SUMMER_END: Final[tuple[int, int]] = (9, 30)
ENERGY_WEIGHT: Final[float] = 0.5
LAMBDA_ENERGY: Final[float] = 1e-4
LAMBDA_TEMPERATURE: Final[float] = 1.0
OFF_HOURS_COMFORT_WEIGHT: Final[float] = 0.1
ACTION_SETPOINTS: Final[list[tuple[float, float]]] = [
    (12.0, 30.0), (13.0, 29.0), (14.0, 28.0), (15.0, 27.0), (16.0, 26.0),
    (17.0, 25.0), (18.0, 24.0), (19.0, 23.25), (20.0, 23.25), (21.0, 23.25),
]
DAYS_BEFORE_MONTH: Final[npt.NDArray[np.int64]] = np.cumsum([0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30])

FEATURE_NAMES: Final[list[str]] = [
    "doy_sin", "doy_cos", "hour_sin", "hour_cos", "is_operating", "is_workday", "hours_until_open",
    "comfort_low", "comfort_up", "temp_below", "temp_above",
    "outdoor_temperature", "outdoor_humidity", "wind_speed", "wind_dir_sin", "wind_dir_cos",
    "diffuse_solar_radiation", "direct_solar_radiation",
    "air_temperature", "air_temperature_delta", "air_humidity", "occupancy",
    "heating_setpoint", "cooling_setpoint",
    "co2_emission", "hvac_power", "hvac_energy",
]

# Notebook `policy_factories` order; `algo` is the results subfolder of a trained agent.
POLICIES: Final[list[dict[str, Any]]] = [
    {"name": "DQN", "algo": "dqn", "score_type": "q_value", "color": "#2a78d6"},
    {"name": "DDQN", "algo": "ddqn", "score_type": "q_value", "color": "#7b4fd6"},
    {"name": "PPO", "algo": "ppo", "score_type": "probability", "color": "#eb6834"},
    {"name": "Rule-based", "algo": None, "score_type": None, "color": "#1baf7a"},
    {"name": "Fixed setpoint", "algo": None, "score_type": None, "color": "#eda100"},
    {"name": "Random", "algo": None, "score_type": None, "color": "#e87ba4"},
]

METRIC_LABELS: Final[dict[str, str]] = {
    "mean_reward": "Mean reward",
    "mean_power_W": "Mean power demand (W)",
    "hvac_energy_kWh": "HVAC energy (kWh)",
    "comfort_violation_op_pct": "Comfort violation, operational (%)",
    "unoccupied_excursion_pct": "Unoccupied excursion (%)",
    "mean_violation_op_C": "Mean violation, operational (°C)",
    "occupied_violation_pct": "Occupied comfort violation (%)",
    "energy_saving_vs_fixed_pct": "Energy saving vs fixed setpoint (%)",
}

# Decisions 0 and 1 depend on the reset observation (decision 0 acts on it; decision 1's temperature delta uses it),
# which the notebook does not log. Their features and scores are left empty rather than guessed.
UNLOGGED_DECISIONS: Final[int] = 2
REWARD_TOLERANCE: Final[float] = 1e-5
METRIC_RTOL: Final[float] = 1e-6
Q_ESTIMATE_TOLERANCE: Final[float] = 1e-3


def comfort_range(month: int, day: int) -> tuple[float, float]:
    return COMFORT_SUMMER if SUMMER_START <= (month, day) <= SUMMER_END else COMFORT_WINTER


def is_workday(day_of_week: int, holiday_index: int) -> bool:
    return day_of_week in WORKDAYS and holiday_index == 0


def is_operating(day_of_week: int, holiday_index: int, hour: int) -> bool:
    return is_workday(day_of_week, holiday_index) and OPERATING_HOURS[0] <= hour < OPERATING_HOURS[1]


@lru_cache(maxsize=None)
def hours_until_open(day_of_week: int, holiday_index: int, hour: int) -> int:
    """Notebook cell 6: future holidays are not known in advance."""
    if is_operating(day_of_week, holiday_index, hour):
        return 0
    for ahead in range(1, 8 * 24):
        days_ahead, future_hour = divmod(hour + ahead, 24)
        future_day = (day_of_week - 1 + days_ahead) % 7 + 1
        if is_operating(future_day, holiday_index if days_ahead == 0 else 0, future_hour):
            return ahead
    raise ValueError("No operating hour within a week")


def features(raw: dict[str, float], previous_temperature: float) -> npt.NDArray[np.float32]:
    """Notebook CadenceObservationWrapper.features (cell 8), with the previous temperature passed in."""
    month, day, hour = int(raw["month"]), int(raw["day_of_month"]), int(raw["hour"])
    day_of_week, holiday_index = int(raw["day_of_week"]), int(raw["holiday_index"])
    day_of_year = int(DAYS_BEFORE_MONTH[month - 1]) + day
    low, up = comfort_range(month, day)
    temperature = raw["air_temperature"]
    wind_rad = np.deg2rad(raw["wind_direction"])
    values: dict[str, float] = {
        "doy_sin": np.sin(2 * np.pi * day_of_year / 365),
        "doy_cos": np.cos(2 * np.pi * day_of_year / 365),
        "hour_sin": np.sin(2 * np.pi * hour / 24),
        "hour_cos": np.cos(2 * np.pi * hour / 24),
        "is_operating": float(is_operating(day_of_week, holiday_index, hour)),
        "is_workday": float(is_workday(day_of_week, holiday_index)),
        "hours_until_open": hours_until_open(day_of_week, holiday_index, hour) / 24,
        "comfort_low": low,
        "comfort_up": up,
        "temp_below": max(low - temperature, 0.0),
        "temp_above": max(temperature - up, 0.0),
        "wind_dir_sin": np.sin(wind_rad),
        "wind_dir_cos": np.cos(wind_rad),
        "air_temperature_delta": temperature - previous_temperature,
    }
    return np.array([values[name] if name in values else raw[name] for name in FEATURE_NAMES], dtype=np.float32)


def observations(episode: pd.DataFrame) -> npt.NDArray[np.float32]:
    """Observation each hourly decision acted on: the features of the previous decision's last 15-minute record."""
    records: list[dict[str, float]] = episode.to_dict("records")
    n_decisions = len(records) // ACTION_REPEAT
    obs = np.full((n_decisions, len(FEATURE_NAMES)), np.nan, dtype=np.float32)
    for k in range(UNLOGGED_DECISIONS, n_decisions):
        last = records[k * ACTION_REPEAT - 1]
        previous = records[(k - 1) * ACTION_REPEAT - 1]
        obs[k] = features(last, previous["air_temperature"])
    return obs


def bundle_trace(episode: pd.DataFrame) -> pd.DataFrame:
    """Raw evaluation records plus the derived columns of the bundle contract (notebook cell 10, v2 export)."""
    trace = episode.reset_index(drop=True).copy()
    month = trace["month"].astype(int)
    day = trace["day_of_month"].astype(int)
    hour = trace["hour"].astype(int)
    day_of_week = trace["day_of_week"].astype(int)
    holiday = trace["holiday_index"].astype(int)

    trace["step"] = np.arange(len(trace))
    trace["decision_idx"] = trace["step"] // ACTION_REPEAT
    trace["day_of_year"] = DAYS_BEFORE_MONTH[month - 1] + day
    # EnergyPlus logs 3 records for the first hour and 5 for the last; the notebook clips the quarter the same way.
    new_hour = (trace[["month", "day_of_month", "hour"]].diff().abs().sum(axis=1) != 0).cumsum()
    trace["minute"] = trace.groupby(new_hour).cumcount().clip(upper=TIMESTEPS_PER_HOUR - 1) * (60 // TIMESTEPS_PER_HOUR)

    bounds = [comfort_range(m, d) for m, d in zip(month, day)]
    trace["comfort_low"] = [low for low, _ in bounds]
    trace["comfort_up"] = [up for _, up in bounds]
    temperature = trace["air_temperature"].to_numpy()
    trace["violation"] = np.maximum(trace["comfort_low"] - temperature, 0) + np.maximum(temperature - trace["comfort_up"], 0)
    trace["workday"] = day_of_week.isin(WORKDAYS) & (holiday == 0)
    trace["operating"] = trace["workday"] & (hour >= OPERATING_HOURS[0]) & (hour < OPERATING_HOURS[1])
    trace["hours_until_open"] = [hours_until_open(d, h, hr) for d, h, hr in zip(day_of_week, holiday, hour)]
    comfort_weight = np.where(trace["operating"], 1.0, OFF_HOURS_COMFORT_WEIGHT)
    trace["energy_term"] = -ENERGY_WEIGHT * LAMBDA_ENERGY * trace["hvac_power"]
    trace["comfort_term"] = -(1 - ENERGY_WEIGHT) * LAMBDA_TEMPERATURE * comfort_weight * trace["violation"]
    trace["energy_kWh"] = trace["hvac_power"] / TIMESTEPS_PER_HOUR / 1000
    return trace


class CadenceMLP(BaseFeaturesExtractor):
    """Notebook cell 14. Defined here so models load without the cloudpickled (Python-version-specific) class."""

    def __init__(self, observation_space: Any, features_dim: int = 256, hidden_dim: int = 256) -> None:
        super().__init__(observation_space, features_dim)
        n_inputs = int(np.prod(observation_space.shape))
        self.mlp = nn.Sequential(
            nn.Flatten(),
            nn.Linear(n_inputs, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.SiLU(),
            nn.Linear(hidden_dim, features_dim),
            nn.LayerNorm(features_dim),
            nn.SiLU(),
        )

    def forward(self, observations: torch.Tensor) -> torch.Tensor:
        return self.mlp(observations)


def load_agent(run_dir: Path, score_type: str) -> tuple[BaseAlgorithm, Callable[[npt.NDArray[np.float32]], torch.Tensor]]:
    config: dict[str, Any] = json.loads((run_dir / "config.json").read_text())
    extractor = {
        "features_extractor_class": CadenceMLP,
        "features_extractor_kwargs": {"features_dim": config["features_dim"], "hidden_dim": config["hidden_dim"]},
    }
    head = list(config["head_arch"])
    constant: Callable[[float], float] = lambda _: 0.0
    # Inference only: the training schedules are replaced so their pickled closures are never deserialised.
    if score_type == "q_value":
        custom = {"policy_kwargs": {**extractor, "net_arch": head}, "lr_schedule": constant, "exploration_schedule": constant}
        model: BaseAlgorithm = DQN.load(run_dir / "final_model.zip", device="cpu", custom_objects=custom)
    else:
        custom = {
            "policy_kwargs": {**extractor, "net_arch": {"pi": head, "vf": head}, "share_features_extractor": True},
            "lr_schedule": constant,
            "clip_range": constant,
        }
        model = PPO.load(run_dir / "final_model.zip", device="cpu", custom_objects=custom)
    model.policy.set_training_mode(False)

    with (run_dir / "vecnormalize.pkl").open("rb") as f:
        vecnormalize = pickle.load(f)
    mean = vecnormalize.obs_rms.mean
    std = np.sqrt(vecnormalize.obs_rms.var + vecnormalize.epsilon)
    clip = vecnormalize.clip_obs
    return model, lambda obs: torch.as_tensor(np.clip((obs - mean) / std, -clip, clip).astype(np.float32))


def agent_scores(
    model: BaseAlgorithm, normalize: Callable[[npt.NDArray[np.float32]], torch.Tensor], obs: npt.NDArray[np.float32],
) -> tuple[npt.NDArray[np.float64], npt.NDArray[np.float64]]:
    """Per-action scores and (PPO) state value; NaN rows where the observation is unknown."""
    scores = np.full((len(obs), len(ACTION_SETPOINTS)), np.nan)
    value = np.full(len(obs), np.nan)
    known = ~np.isnan(obs).any(axis=1)
    x = normalize(obs[known])
    with torch.no_grad():
        if isinstance(model, DQN):
            scores[known] = model.q_net(x).numpy()
        else:
            scores[known] = model.policy.get_distribution(x).distribution.probs.numpy()
            # PPO trained with normalize_reward=True, so this is on the normalised-reward scale
            value[known] = model.policy.predict_values(x).numpy()[:, 0]
    return scores, value


def decisions_table(episode: pd.DataFrame, obs: npt.NDArray[np.float32], scores: npt.NDArray[np.float64] | None,
                    value: npt.NDArray[np.float64] | None) -> pd.DataFrame:
    n = len(obs)
    n_actions = len(ACTION_SETPOINTS)
    return pd.concat(
        [
            pd.DataFrame({"decision_idx": np.arange(n), "action": episode["action"].to_numpy()[::ACTION_REPEAT][:n]}),
            pd.DataFrame(obs, columns=cb.feature_columns(FEATURE_NAMES)),
            pd.DataFrame(np.full((n, n_actions), np.nan) if scores is None else scores, columns=cb.score_columns(n_actions)),
            pd.DataFrame({"value": np.full(n, np.nan) if value is None else value}),
        ],
        axis=1,
    )


def check_q_estimates(path: Path, scores: npt.NDArray[np.float64], actions: npt.NDArray[np.int64], label: str) -> None:
    """The notebook's q_estimates file holds Q(s, a) of the greedy action, computed from the live observation."""
    if not path.exists():
        return
    reference = pd.read_csv(path)["q_value"].to_numpy()[UNLOGGED_DECISIONS:]
    chosen = scores[np.arange(len(scores)), actions][UNLOGGED_DECISIONS:]
    gap = float(np.abs(chosen - reference).max())
    if gap > Q_ESTIMATE_TOLERANCE:
        raise ValueError(f"{label}: rebuilt Q-values differ from {path.name} by up to {gap:.3g}")
    print(f"  {label}: chosen Q matches {path.name} (max |diff| {gap:.1e})")


def algorithms(results_dir: Path) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for policy in POLICIES:
        if policy["algo"] is None:
            continue
        run_dir = results_dir / policy["algo"]
        state = json.loads((run_dir / "training_state.json").read_text())
        out[policy["algo"]] = {
            "config": json.loads((run_dir / "config.json").read_text()),
            "train_time_sec": state["train_time_sec"],
            "timesteps": state["timesteps"],
        }
    return out


def check_metrics(bundle_metrics: pd.DataFrame, results_dir: Path) -> None:
    notebook = pd.read_csv(results_dir / "evaluation_metrics.csv")
    notebook["policy"] = notebook["policy"].map(cb.policy_key)
    notebook = notebook.set_index(["policy", "climate"])
    ours = bundle_metrics.set_index(["policy", "climate"]).loc[notebook.index]
    for metric in notebook.columns:
        if not np.allclose(ours[metric], notebook[metric], rtol=METRIC_RTOL, equal_nan=True):
            raise ValueError(f"Metric '{metric}' recomputed from the traces differs from evaluation_metrics.csv")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("results_dir", type=Path, help="the notebook's RESULTS_DIR, e.g. path/to/results/cadence_v3")
    parser.add_argument("--bundle-id", help="defaults to the results folder name")
    parser.add_argument("--out", type=Path, help="defaults to public/bundles/<bundle id>")
    args = parser.parse_args()

    results_dir: Path = args.results_dir.resolve()
    bundle_id: str = args.bundle_id or results_dir.name
    out_dir: Path = args.out or Path(__file__).resolve().parent.parent / "public" / "bundles" / bundle_id
    eval_dir = results_dir / "eval_episodes"

    traces: dict[tuple[str, str], pd.DataFrame] = {}
    decisions: dict[tuple[str, str], pd.DataFrame] = {}
    agents = {p["algo"]: load_agent(results_dir / p["algo"], p["score_type"]) for p in POLICIES if p["algo"] is not None}

    for climate in CLIMATES:
        for policy in POLICIES:
            key = cb.policy_key(policy["name"])
            label = f"{climate}/{key}"
            episode = pd.read_csv(eval_dir / f"{key}_{climate}.csv.gz")
            trace = bundle_trace(episode)
            reward_gap = float((trace["energy_term"] + trace["comfort_term"] - trace["reward"]).abs().max())
            if reward_gap > REWARD_TOLERANCE:
                raise ValueError(f"{label}: reward terms differ from the logged reward by up to {reward_gap:.3g}")
            traces[(climate, key)] = trace

            obs = observations(episode)
            if policy["algo"] is None:
                decisions[(climate, key)] = decisions_table(episode, obs, None, None)
                continue
            model, normalize = agents[policy["algo"]]
            scores, value = agent_scores(model, normalize, obs)
            table = decisions_table(episode, obs, scores, value)
            decisions[(climate, key)] = table
            check_q_estimates(eval_dir / f"q_estimates_{key}_{climate}.csv.gz", scores, table["action"].to_numpy(), label)
            print(f"  {label}: scores rebuilt")

    bundle_metrics = cb.add_energy_saving(
        pd.DataFrame(
            [{"policy": key, "climate": climate, **cb.compute_metrics(trace, TIMESTEPS_PER_HOUR)}
             for (climate, key), trace in traces.items()]
        )
    )
    check_metrics(bundle_metrics, results_dir)

    manifest = cb.build_manifest(
        bundle_id=bundle_id,
        first_day_of_week=int(next(iter(traces.values()))["day_of_week"].iloc[0]),
        timesteps_per_hour=TIMESTEPS_PER_HOUR,
        action_repeat=ACTION_REPEAT,
        operating_hours=OPERATING_HOURS,
        workdays=sorted(WORKDAYS),
        comfort_winter=COMFORT_WINTER,
        comfort_summer=COMFORT_SUMMER,
        summer_start=SUMMER_START,
        summer_end=SUMMER_END,
        reward={
            "energy_weight": ENERGY_WEIGHT,
            "lambda_energy": LAMBDA_ENERGY,
            "lambda_temperature": LAMBDA_TEMPERATURE,
            "off_hours_comfort_weight": OFF_HOURS_COMFORT_WEIGHT,
        },
        action_setpoints=ACTION_SETPOINTS,
        train_climate=TRAIN_CLIMATE,
        climates=[{"key": c, "label": c.capitalize(), "env_id": EVAL_ENV_IDS[c]} for c in CLIMATES],
        policies=[
            {
                "key": cb.policy_key(p["name"]),
                "name": p["name"],
                "kind": "agent" if p["algo"] is not None else "baseline",
                "score_type": p["score_type"],
                "color": p["color"],
            }
            for p in POLICIES
        ],
        algorithms=algorithms(results_dir),
        feature_names=FEATURE_NAMES,
        metric_labels=METRIC_LABELS,
    )
    training = {
        p["algo"]: pd.read_csv(results_dir / p["algo"] / "training_episodes.csv") for p in POLICIES if p["algo"] is not None
    }

    cb.write_bundle(out_dir, manifest, traces, decisions, bundle_metrics, training)
    cb.validate_bundle(out_dir)
    print(f"Bundle written and validated: {out_dir}")


if __name__ == "__main__":
    main()
