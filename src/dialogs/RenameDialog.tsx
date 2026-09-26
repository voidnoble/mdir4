import { useState } from "react";
import Dialog from "../components/Dialog";
import { useT } from "../i18n";

interface RenameDialogProps {
  name: string;
  onClose: () => void;
  onSubmit: (newName: string) => void;
  onAdvanced?: () => void;
}

export default function RenameDialog({ name, onClose, onSubmit, onAdvanced }: RenameDialogProps) {
  const t = useT();
  const [draft, setDraft] = useState(name);

  const submit = () => {
    const n = draft.trim();
    if (!n || n === name) {
      onClose();
      return;
    }
    onSubmit(n);
  };

  return (
    <Dialog title={t("rename.title")} onClose={onClose}>
      <div className="form">
        <div className="form-row">
          <label>{t("rename.newName")}</label>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") submit();
            }}
            autoFocus
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div className="btn-row">
          <button className="primary" onClick={submit}>
            {t("rename.change")}
          </button>
          {onAdvanced && <button onClick={onAdvanced}>{t("rnm2.title")}</button>}
          <button onClick={onClose}>{t("dlg.cancel")}</button>
        </div>
      </div>
    </Dialog>
  );
}
