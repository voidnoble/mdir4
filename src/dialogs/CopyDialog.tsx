import { useEffect, useRef, useState } from "react";
import Dialog from "../components/Dialog";
import type { ConflictInfo, OverwritePolicy } from "../lib/fs";
import { fsCheckConflicts } from "../lib/fs";
import { useT } from "../i18n";
import { baseName } from "../lib/path";

interface CopyDialogProps {
  mode: "copy" | "move";
  sources: string[];
  initialDest: string;
  onClose: () => void;
  onStart: (destDir: string, policy: OverwritePolicy) => void;
}

export default function CopyDialog({ mode, sources, initialDest, onClose, onStart }: CopyDialogProps) {
  const t = useT();
  const [dest, setDest] = useState(initialDest);
  const [policy, setPolicy] = useState<OverwritePolicy>("overwrite");
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const timer = useRef<number | null>(null);

  const policies: { value: OverwritePolicy; label: string }[] = [
    { value: "overwrite", label: t("copy.policyOverwrite") },
    { value: "skip", label: t("copy.policySkip") },
    { value: "rename", label: t("copy.policyRename") },
    { value: "newer", label: t("copy.policyNewer") },
  ];

  const title = t(mode === "copy" ? "copy.title" : "copy.titleMove", { n: sources.length });

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const d = dest.trim();
      if (!d) {
        setConflicts([]);
        return;
      }
      fsCheckConflicts(sources, d)
        .then(setConflicts)
        .catch(() => setConflicts([]));
    }, 400);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dest]);

  const start = () => {
    const d = dest.trim();
    if (!d) return;
    onStart(d, policy);
  };

  const shown = sources.slice(0, 5);

  return (
    <Dialog title={title} onClose={onClose}>
      <div className="form">
        <div className="form-row">
          <label>{t("dlg.targetDir")}</label>
          <input
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") start();
            }}
            autoFocus
          />
        </div>
        <div className="form-row">
          <label>{t("dlg.itemsLabel")}</label>
          <div className="src-list">
            {shown.map((s) => (
              <div key={s} title={s}>{baseName(s)}</div>
            ))}
            {sources.length > shown.length && <div>{t("dlg.more", { n: sources.length - shown.length })}</div>}
          </div>
        </div>
        {conflicts.length > 0 && (
          <div className="warn">{t("copy.conflictWarn", { n: conflicts.length })}</div>
        )}
        <div className="form-row">
          <label>{t("dlg.conflictPolicy")}</label>
          <div className="radio-group">
            {policies.map((p) => (
              <label key={p.value}>
                <input
                  type="radio"
                  name="policy"
                  checked={policy === p.value}
                  onChange={() => setPolicy(p.value)}
                />
                {p.label}
              </label>
            ))}
          </div>
        </div>
        <div className="btn-row">
          <button className="primary" onClick={start} disabled={!dest.trim()}>
            {t(mode === "copy" ? "copy.start" : "copy.startMove")}
          </button>
          <button onClick={onClose}>{t("dlg.cancel")}</button>
        </div>
      </div>
    </Dialog>
  );
}
