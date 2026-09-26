import { useState } from "react";
import Dialog from "../components/Dialog";
import { useT } from "../i18n";
import { baseName } from "../lib/path";

interface DeleteDialogProps {
  paths: string[];
  defaultPermanent: boolean;
  onClose: () => void;
  onStart: (permanent: boolean) => void;
}

export default function DeleteDialog({ paths, defaultPermanent, onClose, onStart }: DeleteDialogProps) {
  const t = useT();
  const [permanent, setPermanent] = useState(defaultPermanent);
  const shown = paths.slice(0, 5);

  return (
    <Dialog title={t("del.title", { n: paths.length })} onClose={onClose}>
      <div className="form">
        <div className="form-row">
          <label>{t("dlg.itemsLabel")}</label>
          <div className="src-list">
            {shown.map((s) => (
              <div key={s} title={s}>{baseName(s)}</div>
            ))}
            {paths.length > shown.length && <div>{t("dlg.more", { n: paths.length - shown.length })}</div>}
          </div>
        </div>
        <div className="form-row">
          <label>{t("del.mode")}</label>
          <div className="radio-group">
            <label>
              <input type="radio" checked={!permanent} onChange={() => setPermanent(false)} />
              {t("del.trash")}
            </label>
            <label>
              <input type="radio" checked={permanent} onChange={() => setPermanent(true)} />
              {t("del.permanent")}
            </label>
          </div>
        </div>
        {permanent && <div className="warn">{t("del.warnPermanent")}</div>}
        <div className="btn-row">
          <button className="danger" onClick={() => onStart(permanent)} autoFocus>
            {t("del.start")}
          </button>
          <button onClick={onClose}>{t("dlg.cancel")}</button>
        </div>
      </div>
    </Dialog>
  );
}
