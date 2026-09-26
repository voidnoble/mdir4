import { useMemo, useState } from "react";
import Dialog from "../components/Dialog";
import type { QcdEntry } from "../lib/config";
import { useT } from "../i18n";

interface QcdDialogProps {
  entries: QcdEntry[];
  currentPath: string;
  onClose: () => void;
  onJump: (path: string) => void;
  onSave: (entries: QcdEntry[]) => void;
}

/** QCD: quick-change directory favorites. Type to filter, Enter jumps. */
export default function QcdDialog({ entries, currentPath, onClose, onJump, onSave }: QcdDialogProps) {
  const t = useT();
  const [filter, setFilter] = useState("");
  const [cursor, setCursor] = useState(0);
  const [list, setList] = useState<QcdEntry[]>(entries);

  const visible = useMemo(() => {
    const f = filter.toLowerCase();
    return list.filter((e) => !f || e.name.toLowerCase().includes(f) || e.path.toLowerCase().includes(f));
  }, [list, filter]);

  const cur = visible[Math.min(cursor, Math.max(0, visible.length - 1))];

  const addCurrent = () => {
    const name = currentPath.split(/[\\/]/).filter(Boolean).pop() ?? currentPath;
    const next = [...list, { name, path: currentPath, hotkey: "" }];
    setList(next);
    onSave(next);
  };

  const removeAt = (idx: number) => {
    const target = visible[idx];
    if (!target) return;
    const next = list.filter((e) => e !== target);
    setList(next);
    onSave(next);
    setCursor(0);
  };

  const onKey = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
        break;
      case "ArrowDown":
        e.preventDefault();
        setCursor((c) => Math.min(visible.length - 1, c + 1));
        break;
      case "Enter":
        e.preventDefault();
        if (cur) {
          onJump(cur.path);
        }
        break;
      case "Delete":
        e.preventDefault();
        removeAt(cursor);
        break;
    }
  };

  return (
    <Dialog title={t("qcd.title")} onClose={onClose}>
      <div className="form" onKeyDown={onKey}>
        <div className="form-row">
          <label>{t("qcd.filter")}</label>
          <input
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setCursor(0);
            }}
            autoFocus
            placeholder={t("qcd.filterPh")}
          />
        </div>
        <div className="zip-list" style={{ maxHeight: 260 }}>
          {visible.map((e, i) => (
            <div
              key={`${e.path}-${i}`}
              className={`zip-row${i === cursor ? " sel" : ""}`}
              onClick={() => setCursor(i)}
              onDoubleClick={() => onJump(e.path)}
              title={e.path}
            >
              <span className="zip-name">📁 {e.name}</span>
              <span className="zip-size">{e.hotkey}</span>
            </div>
          ))}
          {visible.length === 0 && <div className="hint">{t("qcd.empty")}</div>}
        </div>
        <div className="progress-meta">
          <span className="hint">{cur?.path}</span>
        </div>
        <div className="btn-row">
          <button className="primary" disabled={!cur} onClick={() => cur && onJump(cur.path)}>
            {t("qcd.jump")}
          </button>
          <button onClick={addCurrent}>{t("qcd.addCurrent")}</button>
          <button onClick={() => removeAt(cursor)} disabled={!cur}>
            {t("qcd.del")}
          </button>
          <button onClick={onClose}>{t("dlg.close")}</button>
        </div>
      </div>
    </Dialog>
  );
}
