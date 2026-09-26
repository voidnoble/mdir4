import Dialog from "../components/Dialog";
import type { OpSummary } from "../lib/fs";
import { useT } from "../i18n";

interface ResultDialogProps {
  title: string;
  summary: OpSummary;
  onClose: () => void;
}

export default function ResultDialog({ title, summary, onClose }: ResultDialogProps) {
  const t = useT();
  return (
    <Dialog title={title} onClose={onClose}>
      <div className="form">
        <div className="form-row">
          <label>{t("dlg.result")}</label>
          <div>
            {t("dlg.doneResult", { done: summary.filesDone, total: summary.filesTotal })}
            {summary.cancelled && ` ${t("dlg.cancelledMark")}`}
            {summary.skipped.length > 0 && ` · ${t("dlg.skipped", { n: summary.skipped.length })}`}
          </div>
        </div>
        {summary.errors.length > 0 && (
          <div className="form-row">
            <label>{t("dlg.errors")}</label>
            <div className="src-list error-list">
              {summary.errors.slice(0, 20).map((e, i) => (
                <div key={i} title={e}>{e}</div>
              ))}
              {summary.errors.length > 20 && <div>{t("dlg.more", { n: summary.errors.length - 20 })}</div>}
            </div>
          </div>
        )}
        <div className="btn-row">
          <button className="primary" onClick={onClose} autoFocus>
            {t("dlg.close")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
