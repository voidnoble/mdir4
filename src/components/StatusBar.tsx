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

const num = (n: number) => n.toLocaleString("en-US");

/** App-level status bar (WinM classic): active panel stats + drive space + cursor info. */
export default function StatusBar({ panel }: { panel: PanelApi }) {
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

  const cursorEntry = state.entries[state.cursor];
  const pct = disk && disk.total > 0 ? ((disk.free / disk.total) * 100).toFixed(1) : null;

  return (
    <div className="statusbar">
      <span className="seg">
        {t("status.counts", { d: dirs, f: files, b: num(bytes) })}
        {state.selected.size > 0 && ` · ${t("panel.selected", { n: state.selected.size })}`}
        {state.filter && ` · ${t("panel.filter", { f: state.filter })}`}
      </span>
      <span className="seg grow">
        {disk && pct !== null
          ? t("status.driveFree", {
              v: volumeLabel(state.path),
              s: num(disk.free),
              p: pct,
            })
          : ""}
      </span>
      <span className="seg right">
        {cursorEntry
          ? `${cursorEntry.name}${cursorEntry.isDir ? "" : ` · ${formatSize(cursorEntry.size)}`} · ${formatDate(cursorEntry.modifiedMs)}`
          : ""}
      </span>
    </div>
  );
}
