import { useState } from "react";
import Dialog from "../components/Dialog";
import { useT } from "../i18n";
import { baseName } from "../lib/path";

interface CombineDialogProps {
  firstPart: string;
  initialDest: string;
  onClose: () => void;
  onStart: (destPath: string) => void;
}

export default function CombineDialog({ firstPart, initialDest, onClose, onStart }: CombineDialogProps) {
  const t = useT();
  const [dest, setDest] = useState(initialDest);

  const start = () => {
    if (!dest.trim()) return;
    onStart(dest.trim());
  };

  return (
    <Dialog title={t("combine.title")} onClose={onClose}>
      <div className="form">
        <div className="form-row">
          <label>{t("combine.file")}</label>
          <div className="src-list">
            <div title={firstPart}>{baseName(firstPart)}</div>
          </div>
        </div>
        <div className="form-row">
          <label>{t("combine.target")}</label>
          <input
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") start();
            }}
            autoFocus
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div className="hint">{t("combine.hint")}</div>
        <div className="btn-row">
          <button className="primary" onClick={start} disabled={!dest.trim()}>
            {t("combine.start")}
          </button>
          <button onClick={onClose}>{t("dlg.cancel")}</button>
        </div>
      </div>
    </Dialog>
  );
}
