import { useEffect, useState } from "react";
import Dialog from "../components/Dialog";
import { useT } from "../i18n";
import type { DirSize, FileProps } from "../lib/fs";
import { fsDescGet, fsDescSet, fsDirSize, fsFileProps, fsSetMtime, fsSetReadonly } from "../lib/fs";
import { baseName } from "../lib/path";
import { formatSize } from "../lib/format";

interface PropsDialogProps {
  path: string;
  dir: string;
  name: string;
  onClose: () => void;
  onDone: () => void;
}

const toLocalInput = (unixSecs: number): string => {
  const d = new Date(unixSecs * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const fmtDateTime = (unixSecs: number | null): string =>
  unixSecs ? new Date(unixSecs * 1000).toLocaleString() : "—";

export default function PropsDialog({ path, dir, name, onClose, onDone }: PropsDialogProps) {
  const t = useT();
  const [props, setProps] = useState<FileProps | null>(null);
  const [dirSize, setDirSize] = useState<DirSize | null>(null);
  const [readonly, setReadonly] = useState(false);
  const [mtime, setMtime] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = await fsFileProps(path);
        if (!alive) return;
        setProps(p);
        setReadonly(p.readonly);
        setMtime(toLocalInput(p.modified));
        if (p.isDir) {
          fsDirSize(path)
            .then((d) => alive && setDirSize(d))
            .catch(() => {});
        }
        const d = await fsDescGet(dir, name).catch(() => null);
        if (!alive) return;
        setDesc(d ?? "");
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [path, dir, name]);

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      if (props && readonly !== props.readonly) await fsSetReadonly(path, readonly);
      if (mtime) {
        const ms = new Date(mtime).getTime();
        if (!Number.isNaN(ms)) await fsSetMtime(path, Math.floor(ms / 1000));
      }
      await fsDescSet(dir, name, desc);
      onDone();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog title={t("props.title")} onClose={onClose}>
      <div className="form">
        {busy && <div className="form-row">{t("dlg.preparing")}</div>}
        {err && <div className="form-row form-error">{err}</div>}
        {props && (
          <>
            <div className="form-row">
              <label>{t("props.name")}</label>
              <div className="src-list">
                <div title={path}>{baseName(path)}</div>
              </div>
            </div>
            <div className="form-row">
              <label>{t("props.size")}</label>
              <span>
                {props.isDir
                  ? dirSize
                    ? `${formatSize(dirSize.bytes)} (${dirSize.files}${t("props.filesUnit")}, ${dirSize.dirs}${t("props.dirsUnit")})`
                    : t("dlg.preparing")
                  : formatSize(props.size)}
              </span>
            </div>
            <div className="form-row">
              <label>{t("props.modified")}</label>
              <span>{fmtDateTime(props.modified)}</span>
            </div>
            <div className="form-row">
              <label>{t("props.setMtime")}</label>
              <input
                type="datetime-local"
                value={mtime}
                onChange={(e) => setMtime(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
            <div className="form-row">
              <label>{t("props.readonly")}</label>
              <input
                type="checkbox"
                checked={readonly}
                onChange={(e) => setReadonly(e.target.checked)}
              />
            </div>
            <div className="form-row">
              <label>{t("props.desc")}</label>
              <input
                value={desc}
                placeholder={t("props.descPh")}
                onChange={(e) => setDesc(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          </>
        )}
        <div className="btn-row">
          <button className="primary" onClick={save} disabled={busy || saving}>
            {t("dlg.apply")}
          </button>
          <button onClick={onClose}>{t("dlg.cancel")}</button>
        </div>
      </div>
    </Dialog>
  );
}
