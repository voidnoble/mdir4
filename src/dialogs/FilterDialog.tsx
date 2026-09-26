import { useState } from "react";
import Dialog from "../components/Dialog";
import { useT } from "../i18n";

interface FilterDialogProps {
  initial: string;
  onClose: () => void;
  onApply: (filter: string) => void;
}

export default function FilterDialog({ initial, onClose, onApply }: FilterDialogProps) {
  const t = useT();
  const [filter, setFilter] = useState(initial);

  const apply = () => {
    onApply(filter.trim());
    onClose();
  };

  return (
    <Dialog title={t("filter.title")} onClose={onClose}>
      <div className="form">
        <div className="form-row">
          <label>{t("filter.pattern")}</label>
          <input
            value={filter}
            placeholder="*.exe;*.dll"
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") apply();
            }}
            autoFocus
          />
        </div>
        <div className="form-hint">{t("filter.hint")}</div>
        <div className="btn-row">
          <button className="primary" onClick={apply}>
            {t("dlg.apply")}
          </button>
          <button
            onClick={() => {
              setFilter("");
              onApply("");
              onClose();
            }}
          >
            {t("filter.clear")}
          </button>
          <button onClick={onClose}>{t("dlg.cancel")}</button>
        </div>
      </div>
    </Dialog>
  );
}
