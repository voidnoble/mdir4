import { useEffect, useRef, useState } from "react";
import VirtualList from "./VirtualList";
import PathBar from "./PathBar";
import type { PanelApi } from "../hooks/usePanel";
import { fsMakeDir } from "../lib/fs";
import { formatDate, formatSize, fileIcon } from "../lib/format";
import { joinPath } from "../lib/path";
import { useT } from "../i18n";
import { extColorFor, type ExtColors } from "../theme";

const ROW_H = 26;

/** Read a CSS variable (e.g. the directory color) with a fallback. */
function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

interface PanelProps {
  api: PanelApi;
  active: boolean;
  onActivate: () => void;
  label: string;
  extColors?: ExtColors;
  extColorOn?: boolean;
  showColHeader?: boolean;
  /** per-panel path bar (WinM reference: peach when active) */
  showPathBar?: boolean;
  onOpenPath?: () => void;
  /** peach active tint on the path bar; off in single-pane mode (macmdir-default-001.png) */
  activePathTint?: boolean;
  colSep?: boolean;
  rowSep?: boolean;
  folderColor?: boolean;
  rowH?: number;
}

export default function Panel({
  api,
  active,
  onActivate,
  label,
  extColors,
  extColorOn = true,
  showColHeader = true,
  showPathBar = true,
  onOpenPath,
  activePathTint = true,
  colSep = true,
  rowSep = true,
  folderColor = true,
  rowH = ROW_H,
}: PanelProps) {
  const t = useT();
  const { state, listRef, mkdirMode, setMkdirMode } = api;
  const { path, entries, cursor, selected, loading, error } = state;
  const [mkdirDraft, setMkdirDraft] = useState("");
  const mkdirInputRef = useRef<HTMLInputElement>(null);
  // green "found" flash on the cursor row right after a type-ahead jump
  // (per macmdir-type-ahead-search-02.png)
  const [flashOn, setFlashOn] = useState(false);
  const flashTimer = useRef<number | null>(null);

  useEffect(() => {
    if (state.searchFlash === 0) return;
    setFlashOn(true);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashOn(false), 800);
    return () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    };
  }, [state.searchFlash]);

  useEffect(() => {
    if (mkdirMode) {
      setMkdirDraft("");
      setTimeout(() => mkdirInputRef.current?.focus(), 0);
    }
  }, [mkdirMode]);

  const commitMkdir = async () => {
    const name = mkdirDraft.trim();
    setMkdirMode(false);
    if (!name) return;
    try {
      await fsMakeDir(joinPath(path, name));
      api.refresh();
    } catch (e) {
      // keep it quiet in P2; P3 surfaces op errors
      console.warn("mkdir failed", e);
    }
  };

  const renderRow = (i: number) => {
    const e = entries[i];
    if (!e) return null;
    const isCursor = i === cursor;
    const isSelected = selected.has(e.path);
    const isHit = isCursor && flashOn;
    // On the cursor bar (active or inactive) the row uses the bar's text color,
    // so per-extension colors are suppressed there (WinM classic behavior).
    // Off the cursor bar, item name colors follow the settings: hidden >
    // readonly > big-file > folder color / extension color (WinM classic).
    const BIG = 10 * 1024 * 1024;
    let nameColor: string | undefined;
    if (!isCursor) {
      if (e.hidden) nameColor = "var(--hidden-fg)";
      else if (e.readonly && !e.isDir) nameColor = "var(--ro-fg)";
      else if (!e.isDir && e.size >= BIG) nameColor = "var(--bigsize-fg)";
      else if (e.isDir) nameColor = folderColor ? undefined : "var(--fg)";
      else nameColor = extColorFor(extColors, e.name, e.isDir, extColorOn);
    }
    // Type-ahead match: the bar takes the item's own color — the directory
    // color for folders, the extension color for files — instead of a fixed one.
    let hitStyle: { backgroundColor: string; color: string } | undefined;
    if (isHit) {
      const bg = e.isDir
        ? cssVar("--dir-fg", "#ff0000")
        : (extColorFor(extColors, e.name, e.isDir) ?? cssVar("--cursor-bg", "#ff0000"));
      hitStyle = { backgroundColor: bg, color: "var(--cursor-fg)" };
    }
    const dot = e.isDir ? -1 : e.name.lastIndexOf(".");
    const baseName = dot > 0 ? e.name.slice(0, dot) : e.name;
    const ext = dot > 0 ? e.name.slice(dot + 1) : "";
    return (
      <div
        className={`frow${e.isDir ? " is-dir" : ""}${isCursor ? (active ? " cursor" : " cursor-dim") : ""}${isSelected ? " selected" : ""}${isHit ? " search-hit" : ""}`}
        style={hitStyle}
        onMouseDown={() => {
          onActivate();
          // single click on ".." goes straight to the parent directory (WinM)
          if (e.isDir && e.name === "..") api.goParent();
          else api.setCursor(i);
        }}
        onDoubleClick={() => api.enterAtCursor()}
      >
        {isSelected && <span className="sel-mark">▶</span>}
        <span className="c-icon">{e.isDir ? "📁" : fileIcon(e.name)}</span>
        <span className="c-name" title={e.path} style={nameColor ? { color: nameColor } : undefined}>
          {baseName}
          {e.isSymlink ? " 🔗" : ""}
        </span>
        <span className="c-ext">{ext}</span>
        <span className="c-size">{e.isDir ? "" : formatSize(e.size)}</span>
        <span className="c-date">{formatDate(e.modifiedMs)}</span>
      </div>
    );
  };

  return (
    <section
      className={`pane${active ? " active" : ""}${colSep ? "" : " nocolsep"}${rowSep ? "" : " norowsep"}`}
      onMouseDown={onActivate}
      aria-label={label}
    >
      {showPathBar && (
        <PathBar
          path={path}
          filter={state.filter}
          searchBuf={state.searchBuf}
          active={active && activePathTint}
          onOpen={() => {
            onActivate();
            onOpenPath?.();
          }}
        />
      )}
      {mkdirMode && (
        <div className="mkdir-row">
          <span>{t("panel.newFolder")}</span>
          <input
            ref={mkdirInputRef}
            value={mkdirDraft}
            onChange={(ev) => setMkdirDraft(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") commitMkdir();
              else if (ev.key === "Escape") setMkdirMode(false);
              ev.stopPropagation();
            }}
            placeholder={t("panel.folderNamePh")}
          />
        </div>
      )}

      {showColHeader && <div className="col-header">
        <span className="c-icon" />
        <button
          className={`c-name sort-hdr${state.sortKey === "name" ? " sorted" : ""}`}
          onClick={() => api.setSort("name", state.sortKey === "name" && state.sortDir === "asc" ? "desc" : "asc")}
          title={t("sort.byName")}
        >
          {t("panel.name")}
          {state.sortKey === "name" ? (state.sortDir === "asc" ? " ▲" : " ▼") : ""}
        </button>
        <button
          className={`c-ext sort-hdr${state.sortKey === "ext" ? " sorted" : ""}`}
          onClick={() => api.setSort("ext", state.sortKey === "ext" && state.sortDir === "asc" ? "desc" : "asc")}
          title={t("sort.byExt")}
        >
          {t("panel.ext")}
          {state.sortKey === "ext" ? (state.sortDir === "asc" ? " ▲" : " ▼") : ""}
        </button>
        <button
          className={`c-size sort-hdr${state.sortKey === "size" ? " sorted" : ""}`}
          onClick={() => api.setSort("size", state.sortKey === "size" && state.sortDir === "asc" ? "desc" : "asc")}
          title={t("sort.bySize")}
        >
          {t("panel.size")}
          {state.sortKey === "size" ? (state.sortDir === "asc" ? " ▲" : " ▼") : ""}
        </button>
        <button
          className={`c-date sort-hdr${state.sortKey === "mtime" ? " sorted" : ""}`}
          onClick={() => api.setSort("mtime", state.sortKey === "mtime" && state.sortDir === "asc" ? "desc" : "asc")}
          title={t("sort.byDate")}
        >
          {t("panel.date")}
          {state.sortKey === "mtime" ? (state.sortDir === "asc" ? " ▲" : " ▼") : ""}
        </button>
      </div>}

      <div className="pane-body">
        {loading ? (
          <div className="pane-msg">{t("panel.loading")}</div>
        ) : error ? (
          <div className="pane-msg error">
            {error}
            <button onClick={() => api.refresh()}>{t("panel.retry")}</button>
          </div>
        ) : entries.length === 0 ? (
          <div className="pane-msg">{t("panel.empty")}</div>
        ) : (
          <VirtualList
            ref={listRef}
            itemCount={entries.length}
            rowHeight={rowH}
            resetKey={path}
            renderRow={renderRow}
          />
        )}
      </div>
    </section>
  );
}
