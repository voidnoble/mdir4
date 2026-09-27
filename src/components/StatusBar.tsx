import { useEffect, useState } from "react";
import type { PanelApi } from "../hooks/usePanel";
import { fsDiskSpace, type DiskSpace } from "../lib/fs";
import { formatDate, formatSize } from "../lib/format";
import { useT } from "../i18n";

function volumeLabel(path: string): string {
  const m = path.match(/^[a-zA-Z]:/);
  if (m) return m[0].toUpperCase();
  return "/";
}

function baseNameOf(path: string): string {
  const p = path.replace(/[\\/]+$/, "");
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i >= 0 ? p.slice(i + 1) : p;
}

const num = (n: number) => n.toLocaleString("en-US");

/** App-level status bar (WinM classic): active panel stats + drive space + cursor info. */
export default function StatusBar({ panel, showDrive = true, kbMb = false }: { panel: PanelApi; showDrive?: boolean; kbMb?: boolean }) {
  const t = useT();
  const { state } = panel;
  const [disk, setDisk] = useState<DiskSpace | null>(null);

  useEffect(() => {
    let live = true;
    fsDiskSpace(state.path)
      .then((d) => {
        if (live) setDisk(d);
      })
      .catch(() => {
        if (live) setDisk(null);
      });
    return () => {
      live = false;
    };
  }, [state.path]);

  let dirs = 0;
  let files = 0;
  let bytes = 0;
  for (const e of state.allEntries) {
    if (e.isDir) dirs++;
    else {
      files++;
      bytes += e.size;
    }
  }

  // selected objects info (WinM): count + total size of the selection
  let selBytes = 0;
  if (state.selected.size > 0) {
    for (const e of state.entries) {
      if (state.selected.has(e.path)) selBytes += e.size;
    }
  }

  const cursorEntry = state.entries[state.cursor];
  const pct = disk && disk.total > 0 ? ((disk.free / disk.total) * 100).toFixed(1) : null;

  return (
    <div className="statusbar">
      <span className="sb-icon">ⓘ</span>
      <span className="sb-left">
        {kbMb
          ? t("status.countsKbMb", { d: dirs, f: files, b: formatSize(bytes) })
          : t("status.counts", { d: dirs, f: files, b: num(bytes) })}
        {state.selected.size > 0 &&
          ` · ${t("panel.selected", { n: state.selected.size, b: num(selBytes) })}`}
        {state.filter && ` · ${t("panel.filter", { f: state.filter })}`}
      </span>
      <span className="sb-mid">
        {showDrive && disk && pct !== null && (
          <>
            {t("status.driveFree", {
              v: volumeLabel(state.path),
              s: num(disk.free),
              p: pct,
            })}{" "}
            <span className="sb-dir">{baseNameOf(state.path)}</span>
          </>
        )}
      </span>
      <span className="sb-right">
        {cursorEntry
          ? `${cursorEntry.name}${cursorEntry.isDir ? "" : ` · ${formatSize(cursorEntry.size)}`} · ${formatDate(cursorEntry.modifiedMs)}`
          : ""}
      </span>
    </div>
  );
}
