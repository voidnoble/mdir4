/** Human-readable formatting helpers. */

/** Display options driven by the settings window (표시 tab). */
export interface DisplayOpts {
  hour24: boolean;
  year4: boolean;
  /** "바이트단위" shows raw byte counts; otherwise auto units */
  sizeUnit: string;
}

export const displayOpts: DisplayOpts = {
  hour24: true,
  year4: true,
  sizeUnit: "바이트단위",
};

export function setDisplayOpts(o: Partial<DisplayOpts>): void {
  Object.assign(displayOpts, o);
}

export function formatSize(bytes: number): string {
  if (bytes < 0) return "";
  if (displayOpts.sizeUnit === "바이트단위") {
    return `${bytes.toLocaleString("en-US")} B`;
  }
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[u]}`;
}

export function formatDate(modifiedMs: number | null): string {
  if (modifiedMs == null) return "";
  const d = new Date(modifiedMs);
  const fullYear = d.getFullYear();
  const y = displayOpts.year4 ? String(fullYear) : String(fullYear).slice(2);
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  let h = d.getHours();
  let suffix = "";
  if (!displayOpts.hour24) {
    suffix = h < 12 ? " 오전" : " 오후";
    h = h % 12;
    if (h === 0) h = 12;
  }
  const hh = String(h).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${day}${suffix} ${hh}:${mi}`;
}

const ICONS: Record<string, string> = {
  txt: "📄", md: "📄", log: "📄",
  zip: "📦", "7z": "📦", rar: "📦", tar: "📦", gz: "📦",
  png: "🖼️", jpg: "🖼️", jpeg: "🖼️", gif: "🖼️", bmp: "🖼️", svg: "🖼️", webp: "🖼️",
  mp3: "🎵", wav: "🎵", flac: "🎵", ogg: "🎵",
  mp4: "🎬", mkv: "🎬", avi: "🎬", mov: "🎬",
  pdf: "📕",
  exe: "⚙️", msi: "⚙️", sh: "⚙️",
  rs: "🦀", ts: "📘", js: "📒", py: "🐍", html: "🌐", css: "🎨", json: "📋",
};

export function fileIcon(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx > 0) {
    const ext = name.slice(idx + 1).toLowerCase();
    if (ICONS[ext]) return ICONS[ext];
  }
  return "📄";
}
