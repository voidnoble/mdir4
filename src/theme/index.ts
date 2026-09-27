/** Theme system: built-in dark/light + WinM .col import. */

export type ThemeName = "dark" | "light" | "custom";

/** CSS variable overrides, e.g. { "--bg": "#1e1e1e" } */
export type ThemeVars = Record<string, string>;

/** extension (lowercase, no dot) -> css color, from WinM [ExtColor] */
export type ExtColors = Record<string, string>;

export interface ParsedCol {
  vars: ThemeVars;
  extColors: ExtColors;
}

function rgb(v: string): string | null {
  const m = v.trim().match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
  if (!m) return null;
  const c = [1, 2, 3].map((i) => Math.max(0, Math.min(255, parseInt(m[i], 10))));
  return `#${c.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt)));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** WinM .col [Color] key -> Mdir4 CSS variable. */
const COLOR_MAP: Record<string, string> = {
  BackColor: "--bg",
  NormalColor: "--fg",
  DirColor: "--dir-fg",
  HiddenColor: "--hidden-fg",
  DescColor: "--info",
  SelColor: "--sel-name",
  GridColor: "--border",
  DrvColor: "--accent",
};

/** Extra color items the settings window edits (css var -> .col key). */
const EXTRA_COLOR_MAP: Record<string, string> = {
  CursorColor: "--cursor-bg",
  RowSepColor: "--rowsep",
  ReadOnlyColor: "--ro-fg",
  BigSizeColor: "--bigsize-fg",
  TreeBackColor: "--mcd-bg",
  TreeTextColor: "--mcd-fg",
};

function hexToRgb(hex: string): string | null {
  const m = hex.trim().match(/^#([0-9a-fA-F]{6})$/);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/** Serialize theme vars + extension colors to a WinM .col file. */
export function serializeCol(vars: Record<string, string>, extColors: ExtColors): string {
  const varToKey: Record<string, string> = {};
  for (const [k, v] of Object.entries(COLOR_MAP)) varToKey[v] = k;
  for (const [k, v] of Object.entries(EXTRA_COLOR_MAP)) varToKey[v] = k;
  const lines = ["[Color]"];
  for (const [v, hex] of Object.entries(vars)) {
    const key = varToKey[v];
    const rgbStr = hexToRgb(hex);
    if (key && rgbStr) lines.push(`${key}=${rgbStr}`);
  }
  lines.push("", "[ExtColor]");
  const groups: Record<string, string[]> = {};
  for (const [ext, hex] of Object.entries(extColors)) {
    (groups[hex] ??= []).push(ext);
  }
  for (const [hex, exts] of Object.entries(groups)) {
    const rgbStr = hexToRgb(hex);
    if (rgbStr) lines.push(`${exts.sort().join(";")}=${rgbStr}`);
  }
  return lines.join("\r\n") + "\r\n";
}

export function parseCol(text: string): ParsedCol {
  const vars: ThemeVars = {};
  const extColors: ExtColors = {};
  let section = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(";")) continue;
    const sec = line.match(/^\[(.+)\]$/);
    if (sec) {
      section = sec[1];
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    if (section === "Color") {
      const cssVar = COLOR_MAP[key];
      const color = rgb(val);
      if (cssVar && color) vars[cssVar] = color;
      if (key === "BackColor" && color) {
        // derive a coherent dark/light-ish palette from the background
        vars["--bg3"] = shade(color, 14);
        vars["--bg2"] = shade(color, 8);
        vars["--bg4"] = shade(color, 6);
        vars["--row-hover"] = shade(color, 10);
        vars["--cursor-bg"] = shade(color, 28);
        // inactive selection bar: a darker shade of the cursor color
        vars["--cursor-dim-bg"] = shade(vars["--cursor-bg"], -110);
      }
      if (key === "ItemColorEnable" || key === "ExtColorEnable") {
        // flags; ext colors apply when the section is non-empty
      }
    } else if (section === "ExtColor") {
      const color = rgb(val);
      if (!color) continue;
      for (const ext of key.split(";")) {
        const e = ext.trim().toLowerCase();
        if (e) extColors[e] = color;
      }
    }
  }
  return { vars, extColors };
}

/** Apply a built-in theme name. Clears any custom overrides. */
export function setTheme(name: Exclude<ThemeName, "custom">): void {
  const root = document.documentElement;
  root.dataset.theme = name;
  for (const k of Array.from(root.style)) {
    if (k.startsWith("--")) root.style.removeProperty(k);
  }
}

/** Apply custom CSS variable overrides on top of the current theme. */
export function applyCustomVars(vars: ThemeVars): void {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
}

export function extColorFor(
  extColors: ExtColors | undefined,
  fileName: string,
  isDir: boolean,
  extColorOn = true,
): string | undefined {
  if (isDir || !extColorOn) return undefined;
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return undefined;
  const ext = fileName.slice(dot + 1).toLowerCase();
  return extColors?.[ext] ?? DEFAULT_EXT_COLORS[ext];
}

/** Built-in WinM-classic extension colors (used when no custom colors are set). */
export const DEFAULT_EXT_COLORS: ExtColors = {
  zip: "#ff00ff",
  "7z": "#ff00ff",
  rar: "#ff00ff",
  tar: "#ff00ff",
  gz: "#ff00ff",
  bz2: "#ff00ff",
  xz: "#ff00ff",
  zst: "#ff00ff",
  "001": "#ff00ff",
};
