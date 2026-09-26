import { useState } from "react";
import Dialog from "../components/Dialog";
import { useT } from "../i18n";
import { baseName, joinPath } from "../lib/path";

interface ZipDialogProps {
  sources: string[];
  initialDest: string;
  extPacker?: string;
  onClose: () => void;
  onStart: (destZip: string) => void;
  onExtPack?: () => void;
}

export default function ZipDialog({ sources, initialDest, extPacker, onClose, onStart, onExtPack }: ZipDialogProps) {
  const t = useT();
  const [dest, setDest] = useState(initialDest);
  const shown = sources.slice(0, 5);

  const start = () => {
    let d = dest.trim();
    if (!d) return;
    if (!d.toLowerCase().endsWith(".zip")) d += ".zip";
    onStart(d);
  };

  return (
    <Dialog title={t("zip.title", { n: sources.length })} onClose={onClose}>
      <div className="form">
        <div className="form-row">
          <label>{t("zip.file")}</label>
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
          <label>{t("dlg.itemsLabel")}</label>
          <div className="src-list">
            {shown.map((s) => (
              <div key={s} title={s}>{baseName(s)}</div>
            ))}
            {sources.length > shown.length && <div>{t("dlg.more", { n: sources.length - shown.length })}</div>}
          </div>
        </div>
        <div className="btn-row">
          <button className="primary" onClick={start} disabled={!dest.trim()}>
            {t("zip.start")}
          </button>
          {extPacker && onExtPack && (
            <button onClick={onExtPack} title={extPacker}>
              {t("zip.extPack")}
            </button>
          )}
          <button onClick={onClose}>{t("dlg.cancel")}</button>
        </div>
      </div>
    </Dialog>
  );
}

export function defaultZipDest(sources: string[], destDir: string): string {
  const first = sources[0] ? baseName(sources[0]).replace(/\.[^.]*$/, "") : "archive";
  return joinPath(destDir, `${first}.zip`);
}
