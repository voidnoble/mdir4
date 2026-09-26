/** Cross-platform path helpers (work with both `/` and `\` separators). */

export function detectSep(path: string): string {
  return path.includes("\\") ? "\\" : "/";
}

export function joinPath(dir: string, name: string): string {
  const sep = detectSep(dir);
  const base = dir.replace(/[\\/]+$/, "");
  return base + sep + name;
}

export function parentDir(path: string): string {
  if (path === "/" || /^[A-Za-z]:[\\/]?$/.test(path)) return path;
  const trimmed = path.replace(/[\\/]+$/, "");
  const idx = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  if (idx < 0) return trimmed;
  const parent = trimmed.slice(0, idx);
  if (parent === "") return "/";
  if (/^[A-Za-z]:$/.test(parent)) return parent + "\\";
  return parent;
}

export function baseName(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, "");
  const idx = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return idx < 0 ? trimmed : trimmed.slice(idx + 1);
}

export interface PathSegment {
  label: string;
  path: string;
}

/** Split a path into clickable breadcrumb segments. */
export function splitSegments(path: string): PathSegment[] {
  if (path.startsWith("/")) {
    const parts = path.split("/").filter(Boolean);
    const segs: PathSegment[] = [{ label: "/", path: "/" }];
    let acc = "";
    for (const p of parts) {
      acc += "/" + p;
      segs.push({ label: p, path: acc });
    }
    return segs;
  }
  const m = path.match(/^([A-Za-z]:)([\\/]?)(.*)$/);
  if (m) {
    const segs: PathSegment[] = [{ label: m[1], path: m[1] + "\\" }];
    let acc = m[1] + "\\";
    for (const p of m[3].split(/[\\/]/).filter(Boolean)) {
      acc = joinPath(acc, p);
      segs.push({ label: p, path: acc });
    }
    return segs;
  }
  return [{ label: path, path }];
}
