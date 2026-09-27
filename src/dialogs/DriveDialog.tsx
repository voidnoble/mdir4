import { useEffect, useRef, useState } from "react";
import Dialog from "../components/Dialog";
import { fsRoots, type TreeNode } from "../lib/fs";
import { useT } from "../i18n";

interface DriveDialogProps {
  onSelect: (path: string) => void;
  onClose: () => void;
}

/** F3 드라이브: pick a drive/root and jump the active panel to it. */
export default function DriveDialog({ onSelect, onClose }: DriveDialogProps) {
  const t = useT();
  const [roots, setRoots] = useState<TreeNode[]>([]);
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fsRoots()
      .then((r) => setRoots(r))
      .catch(() => setRoots([]));
  }, []);

  useEffect(() => {
    listRef.current?.focus();
  }, [roots.length]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, roots.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = roots[cursor];
      if (r) onSelect(r.path);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
    e.stopPropagation();
  };

  return (
    <Dialog title={t("drive.title")} onClose={onClose}>
      <div className="form" onKeyDown={onKey}>
        <div ref={listRef} className="tree-list" tabIndex={0}>
          {roots.map((r, i) => (
            <div
              key={r.path}
              className={`tnode${i === cursor ? " cursor" : ""}`}
              onClick={() => setCursor(i)}
              onDoubleClick={() => onSelect(r.path)}
            >
              {r.name}
            </div>
          ))}
          {roots.length === 0 && <div className="hint">{t("mcd.loading")}</div>}
        </div>
        <div className="btn-row">
          <button
            className="primary"
            disabled={roots.length === 0}
            onClick={() => {
              const r = roots[cursor];
              if (r) onSelect(r.path);
            }}
          >
            {t("dlg.ok")}
          </button>
          <button onClick={onClose}>{t("dlg.cancel")}</button>
        </div>
      </div>
    </Dialog>
  );
}
