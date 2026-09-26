import { useSyncExternalStore } from "react";
import { en } from "./en";
import { ko } from "./ko";

export type LangName = "ko" | "en" | "custom";

type Dict = Record<string, string>;

let lang: LangName = "ko";
let customDict: Dict | null = null;
let version = 0;
const listeners = new Set<() => void>();

function base(): Dict {
  return lang === "en" ? en : ko;
}

export function setLang(next: LangName, custom?: Dict | null): void {
  lang = next;
  customDict = custom ?? null;
  version++;
  listeners.forEach((l) => l());
}

export function getLang(): LangName {
  return lang;
}

function lookup(key: string): string {
  if (customDict && customDict[key] !== undefined) return customDict[key];
  const b = base();
  if (b[key] !== undefined) return b[key];
  // fall back to Korean, then the key itself
  if (ko[key] !== undefined) return ko[key];
  return key;
}

/** Translate `key`, replacing `{name}` params. */
export function t(key: string, params?: Record<string, string | number>): string {
  let s = lookup(key);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

/** React hook: re-renders on language change. Returns the `t` function. */
export function useT(): typeof t {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => version,
  );
  return t;
}
