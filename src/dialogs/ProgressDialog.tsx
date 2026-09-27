import { useEffect, useRef, useState } from "react";
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
  showSpeed?: boolean;
}

export default function ProgressDialog({ opId, title, onClose, showSpeed = true }: ProgressDialogProps) {
  const t = useT();
  const [p, setP] = useState<ProgressPayload | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [speed, setSpeed] = useState<string | null>(null);
  const prev = useRef<{ t: number; bytes: number } | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    onFsProgress((payload) => {
      if (payload.opId !== opId) return;
      const now = Date.now();
      const pr = prev.current;
      if (pr && now - pr.t >= 400 && payload.bytesDone > pr.bytes) {
        setSpeed(`${formatSize((payload.bytesDone - pr.bytes) / ((now - pr.t) / 1000))}/s`);
        prev.current = { t: now, bytes: payload.bytesDone };
      } else if (!pr) {
        prev.current = { t: now, bytes: payload.bytesDone };
      }
      setP(payload);
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
          {showSpeed && speed && <span>{speed}</span>}
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
