import { useEffect, useState } from "react";
import Dialog from "../components/Dialog";
import type { ZipEntry } from "../lib/fs";
import { fsZipList } from "../lib/fs";
import { useT } from "../i18n";
import { formatSize } from "../lib/format";
import { baseName } from "../lib/path";

interface ZipViewDialogProps {
  zipPath: string;
  onClose: () => void;
  onExtract: () => void;
}

/** Simple archive viewer: lists zip contents (WinM TArcForm equivalent). */
export default function ZipViewDialog({ zipPath, onClose, onExtract }: ZipViewDialogProps) {
  const t = useT();
  const [entries, setEntries] = useState<ZipEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fsZipList(zipPath)
      .then((list) => {
        if (!cancelled) setEntries(list);
      })
      .catch((e: { message?: string }) => {
        if (!cancelled) setError(e?.message ?? "zip");
      });
    return () => {
      cancelled = true;
    };
  }, [zipPath]);

  const totalSize = entries?.reduce((a, e) => a + e.size, 0) ?? 0;

  return (
    <Dialog title={t("zipview.title", { name: baseName(zipPath) })} onClose={onClose} wide>
      <div className="form">
        {error && <div className="warn">⚠ {error}</div>}
        {!entries && !error && <div>{t("zipview.loading")}</div>}
        {entries && (
          <>
            <div className="zip-list">
              {entries.map((e) => (
                <div key={e.name} className="zip-row" title={e.name}>
                  <span className="zip-name">
                    {e.isDir ? "📁" : "📄"} {e.name}
                  </span>
                  <span className="zip-size">{e.isDir ? "" : formatSize(e.size)}</span>
                </div>
              ))}
            </div>
            <div className="progress-meta">
              <span>{t("zipview.items", { n: entries.length })}</span>
              <span>{t("zipview.total", { size: formatSize(totalSize) })}</span>
            </div>
          </>
        )}
        <div className="btn-row">
          <button className="primary" onClick={onExtract} disabled={!entries}>
            {t("zipview.extract")}
          </button>
          <button onClick={onClose}>{t("dlg.close")}</button>
        </div>
      </div>
    </Dialog>
  );
}
