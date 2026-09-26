import { useState } from "react";
import Dialog from "../components/Dialog";
import type { OverwritePolicy } from "../lib/fs";
import { useT } from "../i18n";
import { baseName } from "../lib/path";

interface ExtractDialogProps {
  zipPath: string;
  initialDest: string;
  onClose: () => void;
  onStart: (destDir: string, policy: OverwritePolicy) => void;
}

export default function ExtractDialog({ zipPath, initialDest, onClose, onStart }: ExtractDialogProps) {
  const t = useT();
  const [dest, setDest] = useState(initialDest);
  const [policy, setPolicy] = useState<OverwritePolicy>("overwrite");

  const policies: { value: OverwritePolicy; label: string }[] = [
    { value: "overwrite", label: t("copy.policyOverwrite") },
    { value: "skip", label: t("copy.policySkip") },
    { value: "rename", label: t("copy.policyRename") },
  ];

  const start = () => {
    const d = dest.trim();
    if (!d) return;
    onStart(d, policy);
  };

  return (
    <Dialog title={t("extract.title")} onClose={onClose}>
      <div className="form">
        <div className="form-row">
          <label>{t("extract.file")}</label>
          <div className="src-list">
            <div title={zipPath}>{baseName(zipPath)}</div>
          </div>
        </div>
        <div className="form-row">
          <label>{t("extract.target")}</label>
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
        <div className="form-row">
          <label>{t("dlg.conflictPolicy")}</label>
          <div className="radio-group">
            {policies.map((p) => (
              <label key={p.value}>
                <input
                  type="radio"
                  name="xpolicy"
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
            {t("extract.start")}
          </button>
          <button onClick={onClose}>{t("dlg.cancel")}</button>
        </div>
      </div>
    </Dialog>
  );
}
