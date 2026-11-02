export type ColorScheme = 'light' | 'dark';

const STORAGE_KEY = 'cadence.colorScheme';

/** The viewer's saved choice, otherwise the system preference. */
export function initialColorScheme(): ColorScheme {
  return storedColorScheme() ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function storeColorScheme(scheme: ColorScheme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, scheme);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the toggle still works for this visit.
  }
}

/** Sets the attribute the stylesheet keys its colour tokens on. */
export function applyColorScheme(scheme: ColorScheme): void {
  document.documentElement.dataset.theme = scheme;
}

function storedColorScheme(): ColorScheme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}
