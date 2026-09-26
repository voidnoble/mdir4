import { useState } from "react";
import Dialog from "../components/Dialog";
import { useT } from "../i18n";

interface SelectDialogProps {
  /** true = select, false = deselect */
  select: boolean;
  onClose: () => void;
  onApply: (pattern: string, select: boolean) => void;
}

export default function SelectDialog({ select, onClose, onApply }: SelectDialogProps) {
  const t = useT();
  const [pattern, setPattern] = useState("*.*");

  const apply = () => {
    if (!pattern.trim()) return;
    onApply(pattern.trim(), select);
    onClose();
  };

  return (
    <Dialog title={t(select ? "sel.titleSelect" : "sel.titleDeselect")} onClose={onClose}>
      <div className="form">
        <div className="form-row">
          <label>{t("sel.pattern")}</label>
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") apply();
            }}
            autoFocus
          />
        </div>
        <div className="form-hint">{t("sel.hint")}</div>
        <div className="btn-row">
          <button className="primary" onClick={apply} disabled={!pattern.trim()}>
            {t("dlg.apply")}
          </button>
          <button onClick={onClose}>{t("dlg.cancel")}</button>
        </div>
      </div>
    </Dialog>
  );
}
