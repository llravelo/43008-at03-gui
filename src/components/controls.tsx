import { useEffect, useId, useRef, useState } from 'react';
import { PolicySwatch } from './PolicySwatch';

export interface Option<T extends string | number> {
  value: T;
  label: string;
}

interface SelectProps<T extends string> {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
}

export function Select<T extends string>({ label, value, options, onChange }: SelectProps<T>) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="select-wrap">
        <select value={value} onChange={(event) => onChange(event.target.value as T)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

interface SegmentedProps<T extends string | number> {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
}

export function Segmented<T extends string | number>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={option.value === value ? 'active' : undefined}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export interface CheckboxMenuOption {
  value: string;
  label: string;
  checked: boolean;
  color?: string;
}

interface CheckboxMenuProps {
  label: string;
  options: readonly CheckboxMenuOption[];
  onToggle: (value: string) => void;
}

/** A button that opens a list of checkboxes; closes on Escape or a click outside. */
export function CheckboxMenu({ label, options, onToggle }: CheckboxMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="checkbox-menu" ref={rootRef}>
      <button
        type="button"
        className="panel-toggle"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        <span className="panel-toggle-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div id={menuId} className="checkbox-menu-list" role="group" aria-label={label}>
          {options.map((option) => (
            <label key={option.value} className="checkbox">
              <input type="checkbox" checked={option.checked} onChange={() => onToggle(option.value)} />
              {option.color !== undefined && <PolicySwatch color={option.color} />}
              {option.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
