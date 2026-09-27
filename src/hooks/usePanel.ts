import { useCallback, useRef, useState } from "react";
import type { FsEntry } from "../lib/fs";
import { fsList } from "../lib/fs";
import { parentDir } from "../lib/path";
import type { VirtualListHandle } from "../components/VirtualList";

export type SortKey = "name" | "ext" | "size" | "mtime";
export type SortDir = "asc" | "desc";

/** `;`-separated glob patterns (`*`, `?`). Empty matches everything. */
export function matchFilter(name: string, filter: string): boolean {
  const pats = filter
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (pats.length === 0) return true;
  const lower = name.toLowerCase();
  return pats.some((p) => {
    const re = new RegExp(
      "^" +
        p
          .toLowerCase()
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\*/g, ".*")
          .replace(/\?/g, ".") +
        "$",
    );
    return re.test(lower);
  });
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

export interface PanelState {
  path: string;
  /** entries after hidden/filter/sort */
  entries: FsEntry[];
  allEntries: FsEntry[];
  showHidden: boolean;
  filter: string;
  sortKey: SortKey;
  sortDir: SortDir;
  cursor: number;
  selected: Set<string>;
  /** type-ahead search buffer (auto-clears after idle); shown in the status bar */
  searchBuf: string;
  loading: boolean;
  error: string | null;
  canBack: boolean;
  canFwd: boolean;
}

export interface PanelApi {
  state: PanelState;
  listRef: React.RefObject<VirtualListHandle | null>;
  mkdirMode: boolean;
  setMkdirMode: (b: boolean) => void;
  load: (path: string) => void;
  refresh: () => void;
  goParent: () => void;
  goBack: () => void;
  goForward: () => void;
  enterAtCursor: () => void;
  setCursor: (i: number) => void;
  moveCursor: (delta: number) => void;
  pageMove: (dir: 1 | -1) => void;
  toggleSelect: () => void;
  toggleSelectDown: () => void;
  selectAll: () => void;
  clearSelection: () => void;
  invertSelection: () => void;
  selectByPattern: (pattern: string, select: boolean) => void;
  toggleHidden: () => void;
  setShowHidden: (b: boolean) => void;
  setFilter: (f: string) => void;
  setSort: (key: SortKey, dir: SortDir) => void;
  /**
   * Type-ahead search: append a char to the buffer and jump the cursor to the
   * first entry whose name starts with it. Typing the same char repeatedly
   * cycles through matches. Returns true when a match was found.
   */
  typeAhead: (ch: string) => boolean;
  /** selected paths, or the cursor item when nothing is selected */
  getTargets: () => string[];
}

const applyView = (
  all: FsEntry[],
  showHidden: boolean,
  filter: string,
  sortKey: SortKey,
  sortDir: SortDir,
): FsEntry[] => {
  const vis = all.filter(
    (e) => (showHidden || !e.hidden) && matchFilter(e.name, filter),
  );
  const dirMul = sortDir === "asc" ? 1 : -1;
  const cmp = (a: FsEntry, b: FsEntry): number => {
    // directories first (classic dual-pane behavior)
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    let r = 0;
    switch (sortKey) {
      case "name":
        r = a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : 0;
        break;
      case "ext":
        r = extOf(a.name) < extOf(b.name) ? -1 : extOf(a.name) > extOf(b.name) ? 1 : 0;
        if (r === 0)
          r = a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : 0;
        break;
      case "size":
        r = a.size - b.size;
        break;
      case "mtime":
        r = (a.modifiedMs ?? 0) - (b.modifiedMs ?? 0);
        break;
    }
    return r * dirMul;
  };
  return [...vis].sort(cmp);
};

export function usePanel(initialPath: string): PanelApi {
  const [state, setState] = useState<PanelState>({
    path: initialPath,
    entries: [],
    allEntries: [],
    showHidden: false,
    filter: "",
    sortKey: "name",
    sortDir: "asc",
    cursor: 0,
    selected: new Set(),
    searchBuf: "",
    loading: true,
    error: null,
    canBack: false,
    canFwd: false,
  });
  const [mkdirMode, setMkdirMode] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const loadId = useRef(0);
  const listRef = useRef<VirtualListHandle | null>(null);
  // type-ahead buffer expiry timer
  const searchTimer = useRef<number | null>(null);
  // navigation history (not in PanelState to keep renders cheap; canBack/canFwd mirror it)
  const histRef = useRef<{ back: string[]; fwd: string[] }>({ back: [], fwd: [] });

  const setCursor = useCallback((i: number) => {
    const len = stateRef.current.entries.length;
    const clamped = Math.max(0, Math.min(len - 1, i));
    setState((s) => (s.cursor === clamped ? s : { ...s, cursor: clamped }));
    requestAnimationFrame(() => listRef.current?.scrollToIndex(clamped));
  }, []);

  const syncHistFlags = useCallback(() => {
    const h = histRef.current;
    setState((s) =>
      s.canBack === (h.back.length > 0) && s.canFwd === (h.fwd.length > 0)
        ? s
        : { ...s, canBack: h.back.length > 0, canFwd: h.fwd.length > 0 },
    );
  }, []);

  const loadAt = useCallback((path: string) => {
    const id = ++loadId.current;
    if (searchTimer.current) {
      window.clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
    setState((s) => ({ ...s, loading: true, error: null, searchBuf: "" }));
    fsList(path)
      .then((allEntries) => {
        if (loadId.current !== id) return;
        setState((s) => {
          const entries = applyView(allEntries, s.showHidden, s.filter, s.sortKey, s.sortDir);
          return {
            ...s,
            path,
            allEntries,
            entries,
            cursor: Math.max(0, Math.min(s.cursor, entries.length - 1)),
            selected: new Set(),
            loading: false,
            error: null,
          };
        });
      })
      .catch((e: { message?: string }) => {
        if (loadId.current !== id) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: e?.message ?? "목록을 읽지 못했습니다",
        }));
      });
  }, []);

  const load = useCallback(
    (path: string) => {
      const cur = stateRef.current.path;
      if (path !== cur) {
        histRef.current.back.push(cur);
        histRef.current.fwd = [];
        syncHistFlags();
      }
      loadAt(path);
    },
    [loadAt, syncHistFlags],
  );

  const refresh = useCallback(() => loadAt(stateRef.current.path), [loadAt]);

  const goBack = useCallback(() => {
    const h = histRef.current;
    const prev = h.back.pop();
    if (prev === undefined) return;
    h.fwd.push(stateRef.current.path);
    syncHistFlags();
    loadAt(prev);
  }, [loadAt, syncHistFlags]);

  const goForward = useCallback(() => {
    const h = histRef.current;
    const next = h.fwd.pop();
    if (next === undefined) return;
    h.back.push(stateRef.current.path);
    syncHistFlags();
    loadAt(next);
  }, [loadAt, syncHistFlags]);

  const goParent = useCallback(() => {
    const p = parentDir(stateRef.current.path);
    if (p !== stateRef.current.path) load(p);
  }, [load]);

  const enterAtCursor = useCallback(() => {
    const s = stateRef.current;
    const e = s.entries[s.cursor];
    if (e && e.isDir) load(e.path);
  }, [load]);

  const moveCursor = useCallback(
    (delta: number) => setCursor(stateRef.current.cursor + delta),
    [setCursor],
  );

  const pageMove = useCallback(
    (dir: 1 | -1) => {
      const page = listRef.current?.getPageSize() ?? 20;
      setCursor(stateRef.current.cursor + dir * page);
    },
    [setCursor],
  );

  const toggleSelect = useCallback(() => {
    setState((s) => {
      const e = s.entries[s.cursor];
      if (!e) return s;
      const next = new Set(s.selected);
      if (next.has(e.path)) next.delete(e.path);
      else next.add(e.path);
      return { ...s, selected: next };
    });
  }, []);

  const toggleSelectDown = useCallback(() => {
    toggleSelect();
    moveCursor(1);
  }, [toggleSelect, moveCursor]);

  const selectAll = useCallback(() => {
    setState((s) => ({ ...s, selected: new Set(s.entries.map((e) => e.path)) }));
  }, []);

  const clearSelection = useCallback(() => {
    setState((s) => (s.selected.size === 0 ? s : { ...s, selected: new Set() }));
  }, []);

  const toggleHidden = useCallback(() => {
    setState((s) => {
      const showHidden = !s.showHidden;
      const entries = applyView(s.allEntries, showHidden, s.filter, s.sortKey, s.sortDir);
      return {
        ...s,
        showHidden,
        entries,
        cursor: Math.max(0, Math.min(s.cursor, entries.length - 1)),
      };
    });
  }, []);

  const setShowHidden = useCallback((showHidden: boolean) => {
    setState((s) => {
      if (s.showHidden === showHidden) return s;
      const entries = applyView(s.allEntries, showHidden, s.filter, s.sortKey, s.sortDir);
      return {
        ...s,
        showHidden,
        entries,
        cursor: Math.max(0, Math.min(s.cursor, entries.length - 1)),
      };
    });
  }, []);

  const setFilter = useCallback((filter: string) => {
    setState((s) => {
      if (s.filter === filter) return s;
      const entries = applyView(s.allEntries, s.showHidden, filter, s.sortKey, s.sortDir);
      const kept = new Set([...s.selected].filter((p) => entries.some((e) => e.path === p)));
      return {
        ...s,
        filter,
        entries,
        cursor: Math.max(0, Math.min(s.cursor, entries.length - 1)),
        selected: kept,
      };
    });
  }, []);

  const setSort = useCallback((sortKey: SortKey, sortDir: SortDir) => {
    setState((s) => {
      if (s.sortKey === sortKey && s.sortDir === sortDir) return s;
      // keep cursor on the same entry across re-sort
      const cur = s.entries[s.cursor]?.path;
      const entries = applyView(s.allEntries, s.showHidden, s.filter, sortKey, sortDir);
      const cursor = cur ? Math.max(0, entries.findIndex((e) => e.path === cur)) : 0;
      return { ...s, sortKey, sortDir, entries, cursor };
    });
  }, []);

  const invertSelection = useCallback(() => {
    setState((s) => {
      const next = new Set<string>();
      for (const e of s.entries) {
        if (!s.selected.has(e.path)) next.add(e.path);
      }
      return { ...s, selected: next };
    });
  }, []);

  const selectByPattern = useCallback((pattern: string, select: boolean) => {
    setState((s) => {
      const next = new Set(s.selected);
      for (const e of s.entries) {
        if (matchFilter(e.name, pattern)) {
          if (select) next.add(e.path);
          else next.delete(e.path);
        }
      }
      return { ...s, selected: next };
    });
  }, []);

  const getTargets = useCallback((): string[] => {
    const s = stateRef.current;
    if (s.selected.size > 0) return [...s.selected];
    const e = s.entries[s.cursor];
    return e ? [e.path] : [];
  }, []);

  const typeAhead = useCallback(
    (ch: string): boolean => {
      const s = stateRef.current;
      if (s.entries.length === 0) return false;
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
      const buf = (s.searchBuf + ch).toLowerCase();
      // repeated same char (e.g. "bb") cycles through matches for that char
      const cycling = buf.length > 1 && buf.split("").every((c) => c === buf[0]);
      const needle = cycling ? buf[0] : buf;
      const start = cycling ? s.cursor + 1 : 0;
      let idx = -1;
      for (let k = 0; k < s.entries.length; k++) {
        const i = (start + k) % s.entries.length;
        if (s.entries[i].name.toLowerCase().startsWith(needle)) {
          idx = i;
          break;
        }
      }
      searchTimer.current = window.setTimeout(() => {
        searchTimer.current = null;
        setState((st) => (st.searchBuf ? { ...st, searchBuf: "" } : st));
      }, 1200);
      setState((st) => (st.searchBuf === buf ? st : { ...st, searchBuf: buf }));
      if (idx >= 0) setCursor(idx);
      return idx >= 0;
    },
    [setCursor],
  );

  return {
    state,
    listRef,
    mkdirMode,
    setMkdirMode,
    load,
    refresh,
    goParent,
    goBack,
    goForward,
    enterAtCursor,
    setCursor,
    moveCursor,
    pageMove,
    toggleSelect,
    toggleSelectDown,
    selectAll,
    clearSelection,
    invertSelection,
    selectByPattern,
    toggleHidden,
    setShowHidden,
    setFilter,
    setSort,
    typeAhead,
    getTargets,
  };
}
