/** WinM-classic form controls: flat #f0f0f0 face, black text, white fields. */
import React from "react";

interface CheckProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  children?: React.ReactNode;
  title?: string;
}

export function WinCheck({ checked, onChange, disabled, children, title }: CheckProps) {
  return (
    <label
      className={`set-check${checked ? " on" : ""}${disabled ? " disabled" : ""}`}
      title={title}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          e.stopPropagation();
          onChange(!checked);
        }
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        tabIndex={-1}
        style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }}
      />
      <span className="box" aria-hidden />
      <span>{children}</span>
    </label>
  );
}

interface RadioProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
  name?: string;
}

export function WinRadio({ checked, onChange, disabled, children, name }: RadioProps) {
  return (
    <label
      className={`set-radio${checked ? " on" : ""}${disabled ? " disabled" : ""}`}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          e.stopPropagation();
          onChange();
        }
      }}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        tabIndex={-1}
        style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }}
      />
      <span className="dot" aria-hidden />
      <span>{children}</span>
    </label>
  );
}

interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: (string | { value: string; label: string })[];
  disabled?: boolean;
  style?: React.CSSProperties;
  title?: string;
}

export function WinSelect({ value, onChange, options, disabled, style, title }: SelectProps) {
  return (
    <span className="set-selectwrap" style={style} title={title}>
      <select
        className="set-select"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        style={{ width: "100%" }}
      >
        {options.map((o) =>
          typeof o === "string" ? (
            <option key={o} value={o}>
              {o}
            </option>
          ) : (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ),
        )}
      </select>
    </span>
  );
}

interface InputProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  title?: string;
}

export function WinInput({ value, onChange, disabled, style, title }: InputProps) {
  return (
    <input
      className="set-input"
      type="text"
      value={value}
      disabled={disabled}
      title={title}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.stopPropagation()}
      style={style}
    />
  );
}

interface BtnProps {
  onClick: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
  wide?: boolean;
  style?: React.CSSProperties;
  title?: string;
}

export function WinButton({ onClick, disabled, children, wide, style, title }: BtnProps) {
  return (
    <button
      type="button"
      className={`set-btn${wide ? " wide" : ""}`}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") e.stopPropagation();
      }}
      style={style}
      title={title}
    >
      {children}
    </button>
  );
}

export function WinGroup({ label, children, style }: { label: string; children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="set-group" style={style}>
      <span className="set-glabel">{label}</span>
      {children}
    </div>
  );
}
