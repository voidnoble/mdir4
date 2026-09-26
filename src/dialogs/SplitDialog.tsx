import { useState } from "react";
import Dialog from "../components/Dialog";
import { useT } from "../i18n";
import { baseName } from "../lib/path";

interface SplitDialogProps {
  path: string;
  initialDest: string;
  onClose: () => void;
  onStart: (destDir: string, chunkSize: number) => void;
}

const MB = 1024 * 1024;

const PRESETS: { label: string; bytes: number }[] = [
  { label: "1.44 MB", bytes: Math.floor(1.44 * MB) },
  { label: "10 MB", bytes: 10 * MB },
  { label: "100 MB", bytes: 100 * MB },
  { label: "650 MB", bytes: 650 * MB },
  { label: "1 GB", bytes: 1024 * MB },
];

export default function SplitDialog({ path, initialDest, onClose, onStart }: SplitDialogProps) {
  const t = useT();
  const [dest, setDest] = useState(initialDest);
  const [preset, setPreset] = useState(1);
  const [customMb, setCustomMb] = useState("50");

  const chunkSize =
    preset >= 0 ? PRESETS[preset].bytes : Math.max(1, Math.floor(parseFloat(customMb) || 0) * MB);

  const start = () => {
    if (!dest.trim() || chunkSize <= 0) return;
    onStart(dest.trim(), chunkSize);
  };

  return (
    <Dialog title={t("split.title")} onClose={onClose}>
      <div className="form">
        <div className="form-row">
          <label>{t("split.file")}</label>
          <div className="src-list">
            <div title={path}>{baseName(path)}</div>
          </div>
        </div>
        <div className="form-row">
          <label>{t("split.target")}</label>
          <input
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        <div className="form-row">
          <label>{t("split.chunk")}</label>
          <div className="radio-group">
            {PRESETS.map((p, i) => (
              <label key={p.label}>
                <input
                  type="radio"
                  name="chunk"
                  checked={preset === i}
                  onChange={() => setPreset(i)}
                />
                {p.label}
              </label>
            ))}
            <label>
              <input
                type="radio"
                name="chunk"
                checked={preset === -1}
                onChange={() => setPreset(-1)}
              />
              {t("split.custom")}
              <input
                type="number"
                min={1}
                value={customMb}
                disabled={preset !== -1}
                onChange={(e) => setCustomMb(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                style={{ width: 70, marginLeft: 6 }}
              />
              MB
            </label>
          </div>
        </div>
        <div className="btn-row">
          <button className="primary" onClick={start} disabled={!dest.trim()}>
            {t("split.start")}
          </button>
          <button onClick={onClose}>{t("dlg.cancel")}</button>
        </div>
      </div>
    </Dialog>
  );
}
