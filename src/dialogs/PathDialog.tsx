import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";

interface PathDialogProps {
  initial: string;
  onGo: (path: string) => void;
  onClose: () => void;
}

/** Path display modal: opened by clicking the app-level path bar. */
export default function PathDialog({ initial, onGo, onClose }: PathDialogProps) {
  const t = useT();
  const [draft, setDraft] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }, []);

  const go = () => {
    const p = draft.trim();
    if (p) onGo(p);
    else onClose();
  };

  return (
    <div className="dlg-overlay" onMouseDown={onClose}>
      <div className="dlg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dlg-title">
          <span>{t("path.title")}</span>
          <button className="dlg-x" onClick={onClose} aria-label={t("dlg.cancel")}>
            ✕
          </button>
        </div>
        <div className="dlg-body">
          <div className="form-row">
            <label>{t("path.label")}</label>
            <input
              ref={inputRef}
              type="text"
              value={draft}
              placeholder={t("path.hint")}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") go();
                else if (e.key === "Escape") onClose();
                e.stopPropagation();
              }}
            />
          </div>
        </div>
        <div className="dlg-footer btn-row">
          <button className="primary" onClick={go}>
            {t("dlg.ok")}
          </button>
          <button onClick={onClose}>{t("dlg.cancel")}</button>
        </div>
      </div>
    </div>
  );
}
