import { useEffect, useState } from "react";
import Dialog from "../components/Dialog";
import type { ProgressPayload } from "../lib/fs";
import { fsCancel, onFsProgress } from "../lib/fs";
import { useT } from "../i18n";
import { baseName } from "../lib/path";
import { formatSize } from "../lib/format";

interface ProgressDialogProps {
  opId: string;
  title: string;
  onClose: () => void;
}

export default function ProgressDialog({ opId, title, onClose }: ProgressDialogProps) {
  const t = useT();
  const [p, setP] = useState<ProgressPayload | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    onFsProgress((payload) => {
      if (payload.opId === opId) setP(payload);
    }).then((u) => {
      unlisten = u;
    });
    return () => {
      if (unlisten) unlisten();
    };
  }, [opId]);

  const cancel = async () => {
    setCancelling(true);
    try {
      await fsCancel(opId);
    } finally {
      // the op reports `done` shortly; the parent closes on invoke settle
    }
  };

  const pct =
    p && p.bytesTotal > 0
      ? Math.min(100, (p.bytesDone / p.bytesTotal) * 100)
      : p && p.filesTotal > 0
        ? Math.min(100, (p.filesDone / p.filesTotal) * 100)
        : 0;

  return (
    <Dialog title={title} onClose={onClose}>
      <div className="form">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="progress-meta">
          <span>
            {p ? t("dlg.filesProgress", { done: p.filesDone, total: p.filesTotal }) : t("dlg.preparing")}
          </span>
          <span>{p && p.bytesTotal > 0 ? `${formatSize(p.bytesDone)} / ${formatSize(p.bytesTotal)}` : ""}</span>
        </div>
        <div className="progress-file" title={p?.currentFile ?? ""}>
          {p?.currentFile ? baseName(p.currentFile) : "…"}
        </div>
        <div className="btn-row">
          <button onClick={cancel} disabled={cancelling || p?.done}>
            {cancelling ? t("dlg.cancelling") : t("dlg.cancelOp")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
