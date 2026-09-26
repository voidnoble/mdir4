/** Batch rename engine (WinM TRenameForm equivalent).
 *
 * Pattern tokens (case-insensitive):
 *   <name>        original stem (without extension)
 *   <ext>         original extension including the dot
 *   <num> / <num:3>  counter, optionally zero-padded
 *   <date> / <date:YYYYMMDD>  current date
 *   <time> / <time:HHMMSS>    current time
 */

export type CaseMode = "keep" | "upper" | "lower" | "cap";

export interface RenameRule {
  pattern: string;
  find: string;
  replace: string;
  caseMode: CaseMode;
  startNum: number;
  step: number;
}

export interface RenamePair {
  from: string;
  to: string;
}

export function stemExt(name: string): [string, string] {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return [name, ""];
  return [name.slice(0, dot), name.slice(dot)];
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function fmtDate(d: Date, fmt: string): string {
  return fmt
    .replace(/YYYY/g, String(d.getFullYear()))
    .replace(/MM/g, pad2(d.getMonth() + 1))
    .replace(/DD/g, pad2(d.getDate()));
}

function fmtTime(d: Date, fmt: string): string {
  return fmt
    .replace(/HH/g, pad2(d.getHours()))
    .replace(/mm/g, pad2(d.getMinutes()))
    .replace(/ss/g, pad2(d.getSeconds()));
}

export function applyPattern(name: string, index: number, rule: RenameRule, now: Date): string {
  const [stem, ext] = stemExt(name);
  const num = rule.startNum + index * rule.step;
  let out = rule.pattern
    .replace(/<name>/gi, stem)
    .replace(/<ext>/gi, ext)
    .replace(/<num(?::(\d+))?>/gi, (_m, p: string | undefined) =>
      p ? String(num).padStart(parseInt(p, 10), "0") : String(num),
    )
    .replace(/<date(?::([^>]+))?>/gi, (_m, f: string | undefined) => fmtDate(now, f ?? "YYYYMMDD"))
    .replace(/<time(?::([^>]+))?>/gi, (_m, f: string | undefined) => fmtTime(now, f ?? "HHMMSS"));
  if (rule.find) out = out.split(rule.find).join(rule.replace);
  switch (rule.caseMode) {
    case "upper":
      return out.toUpperCase();
    case "lower":
      return out.toLowerCase();
    case "cap":
      return out.replace(/(^|[\s_.-])(\S)/g, (_m, p1: string, p2: string) => p1 + p2.toUpperCase());
    default:
      return out;
  }
}

export function previewBatch(names: string[], rule: RenameRule, now = new Date()): RenamePair[] {
  return names.map((from, i) => ({ from, to: applyPattern(from, i, rule, now) }));
}

/** Mark pairs whose target collides with another target or is unchanged. */
export function findDupes(pairs: RenamePair[]): Set<number> {
  const seen = new Map<string, number>();
  const dupes = new Set<number>();
  pairs.forEach((p, i) => {
    const key = p.to.toLowerCase();
    const prev = seen.get(key);
    if (prev !== undefined) {
      dupes.add(prev);
      dupes.add(i);
    } else {
      seen.set(key, i);
    }
    if (p.from === p.to) dupes.add(i);
  });
  return dupes;
}
