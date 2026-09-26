/** Human-readable formatting helpers. */

export function formatSize(bytes: number): string {
  if (bytes < 0) return "";
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
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${day} ${h}:${mi}`;
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
