import { useState } from "react";
import Dialog from "../components/Dialog";
import { useT } from "../i18n";
import type { FsEntry } from "../lib/fs";
import { fsShellOpen, fsWriteText } from "../lib/fs";
import { joinPath } from "../lib/path";
import { formatSize } from "../lib/format";

interface FileListDialogProps {
  dir: string;
  entries: FsEntry[];
  onClose: () => void;
}

type ListFormat = "txt" | "csv";

export default function FileListDialog({ dir, entries, onClose }: FileListDialogProps) {
  const t = useT();
  const [format, setFormat] = useState<ListFormat>("txt");
  const [withSize, setWithSize] = useState(true);
  const [withDate, setWithDate] = useState(true);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const buildText = (): string => {
    const lines: string[] = [];
    if (format === "csv") {
      lines.push(["name", "type", "size", "modified"].join(","));
      for (const e of entries) {
        lines.push(
          [
            `"${e.name.replace(/"/g, '""')}"`,
            e.isDir ? "dir" : "file",
            String(e.size),
            e.modifiedMs ? new Date(e.modifiedMs).toISOString() : "",
          ].join(","),
        );
      }
      return lines.join("\n") + "\n";
    }
    for (const e of entries) {
      const parts = [e.isDir ? `[${e.name}]` : e.name];
      if (withSize && !e.isDir) parts.push(formatSize(e.size));
      if (withDate && e.modifiedMs) parts.push(new Date(e.modifiedMs).toLocaleString());
      lines.push(parts.join("  "));
    }
    return lines.join("\n") + "\n";
  };

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const dest = joinPath(dir, `mdir4-list.${format}`);
      await fsWriteText(dest, buildText());
      setDone(dest);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog title={t("flist.title")} onClose={onClose}>
      <div className="form">
        <div className="form-row">
          <label>{t("flist.count")}</label>
          <span>{entries.length}</span>
        </div>
        <div className="form-row">
          <label>{t("flist.format")}</label>
          <div className="radio-group">
            <label>
              <input
                type="radio"
                name="flist-fmt"
                checked={format === "txt"}
                onChange={() => setFormat("txt")}
              />
              TXT
            </label>
            <label>
              <input
                type="radio"
                name="flist-fmt"
                checked={format === "csv"}
                onChange={() => setFormat("csv")}
              />
              CSV
            </label>
          </div>
        </div>
        {format === "txt" && (
          <>
            <div className="form-row">
              <label>{t("flist.withSize")}</label>
              <input
                type="checkbox"
                checked={withSize}
                onChange={(e) => setWithSize(e.target.checked)}
              />
            </div>
            <div className="form-row">
              <label>{t("flist.withDate")}</label>
              <input
                type="checkbox"
                checked={withDate}
                onChange={(e) => setWithDate(e.target.checked)}
              />
            </div>
          </>
        )}
        {err && <div className="form-row form-error">{err}</div>}
        {done && (
          <div className="form-row">
            <label>{t("flist.saved")}</label>
            <span title={done}>{done}</span>
          </div>
        )}
        <div className="btn-row">
          {!done ? (
            <button className="primary" onClick={save} disabled={saving}>
              {t("flist.save")}
            </button>
          ) : (
            <button
              className="primary"
              onClick={() => {
                fsShellOpen(done).catch(() => {});
                onClose();
              }}
            >
              {t("flist.open")}
            </button>
          )}
          <button onClick={onClose}>{t("dlg.cancel")}</button>
        </div>
      </div>
    </Dialog>
  );
}
