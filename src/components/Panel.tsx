import { useEffect, useRef, useState } from "react";
import VirtualList from "./VirtualList";
import type { PanelApi } from "../hooks/usePanel";
import { fsMakeDir } from "../lib/fs";
import { formatDate, formatSize, fileIcon } from "../lib/format";
import { joinPath, splitSegments } from "../lib/path";
import { useT } from "../i18n";
import { extColorFor, type ExtColors } from "../theme";

const ROW_H = 26;

interface PanelProps {
  api: PanelApi;
  active: boolean;
  onActivate: () => void;
  label: string;
  extColors?: ExtColors;
}

export default function Panel({ api, active, onActivate, label, extColors }: PanelProps) {
  const t = useT();
  const { state, listRef, mkdirMode, setMkdirMode } = api;
  const { path, entries, cursor, selected, loading, error } = state;
  const [editingPath, setEditingPath] = useState(false);
  const [pathDraft, setPathDraft] = useState(path);
  const [mkdirDraft, setMkdirDraft] = useState("");
  const mkdirInputRef = useRef<HTMLInputElement>(null);
  const pathInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mkdirMode) {
      setMkdirDraft("");
      setTimeout(() => mkdirInputRef.current?.focus(), 0);
    }
  }, [mkdirMode]);

  useEffect(() => {
    if (editingPath) {
      setPathDraft(path);
      setTimeout(() => {
        pathInputRef.current?.focus();
        pathInputRef.current?.select();
      }, 0);
    }
  }, [editingPath, path]);

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

  const commitPath = () => {
    setEditingPath(false);
    const p = pathDraft.trim();
    if (p && p !== path) api.load(p);
  };

  const renderRow = (i: number) => {
    const e = entries[i];
    if (!e) return null;
    const isCursor = i === cursor;
    const isSelected = selected.has(e.path);
    // On the cursor bar (active or inactive) the row uses the bar's text color,
    // so per-extension colors are suppressed there (WinM classic behavior).
    const nameColor = isCursor ? undefined : extColorFor(extColors, e.name, e.isDir);
    const dot = e.isDir ? -1 : e.name.lastIndexOf(".");
    const baseName = dot > 0 ? e.name.slice(0, dot) : e.name;
    const ext = dot > 0 ? e.name.slice(dot + 1) : "";
    return (
      <div
        className={`frow${e.isDir ? " is-dir" : ""}${isCursor ? (active ? " cursor" : " cursor-dim") : ""}${isSelected ? " selected" : ""}`}
        onMouseDown={() => {
          onActivate();
          api.setCursor(i);
        }}
        onDoubleClick={() => api.enterAtCursor()}
      >
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

  const cursorEntry = entries[cursor];
  const segments = splitSegments(path);

  return (
    <section
      className={`pane${active ? " active" : ""}`}
      onMouseDown={onActivate}
      aria-label={label}
    >
      <div className="pane-path">
        {mkdirMode ? (
          <div className="inline-input">
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
        ) : editingPath ? (
          <div className="inline-input">
            <input
              ref={pathInputRef}
              value={pathDraft}
              onChange={(ev) => setPathDraft(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") commitPath();
                else if (ev.key === "Escape") setEditingPath(false);
                ev.stopPropagation();
              }}
            />
          </div>
        ) : (
          <div className="breadcrumb" onDoubleClick={() => setEditingPath(true)} title={t("panel.pathEditHint")}>
            {segments.map((s, i) => (
              <span key={s.path}>
                {i > 0 && <span className="sep">›</span>}
                <button
                  className="crumb"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (s.path !== path) api.load(s.path);
                  }}
                >
                  {s.label}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="col-header">
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
      </div>

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
            rowHeight={ROW_H}
            resetKey={path}
            renderRow={renderRow}
          />
        )}
      </div>

      <div className="pane-status">
        <span>
          {t("panel.items", { n: entries.length })}
          {selected.size > 0 && ` · ${t("panel.selected", { n: selected.size })}`}
          {state.filter && ` · ${t("panel.filter", { f: state.filter })}`}
        </span>
        <span className="cursor-info">
          {cursorEntry ? `${cursorEntry.name}${cursorEntry.isDir ? "" : ` · ${formatSize(cursorEntry.size)}`}` : ""}
        </span>
      </div>
    </section>
  );
}
