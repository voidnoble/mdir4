import { useState } from "react";
import Dialog from "../components/Dialog";
import { useT } from "../i18n";
import type { AppConfig, ExtAssoc } from "../lib/config";
import { fsShellOpen } from "../lib/fs";
import { baseName } from "../lib/path";

interface OpenWithDialogProps {
  path: string;
  config: AppConfig;
  onClose: () => void;
  onSaveAssoc: (assoc: ExtAssoc[]) => void;
}

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i).toLowerCase() : "";
}

export default function OpenWithDialog({ path, config, onClose, onSaveAssoc }: OpenWithDialogProps) {
  const t = useT();
  const name = baseName(path);
  const ext = extOf(name);
  const existing = config.assoc.find((a) => a.ext === ext);
  const [program, setProgram] = useState(existing?.program ?? "");
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const open = async (prog: string | undefined) => {
    setErr(null);
    try {
      await fsShellOpen(path, prog || undefined);
      if (remember && ext) {
        const next = config.assoc.filter((a) => a.ext !== ext);
        if (prog) next.push({ ext, program: prog });
        onSaveAssoc(next);
      }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Dialog title={t("openwith.title")} onClose={onClose}>
      <div className="form">
        <div className="form-row">
          <label>{t("openwith.file")}</label>
          <div className="src-list">
            <div title={path}>{name}</div>
          </div>
        </div>
        <div className="form-row">
          <label>{t("openwith.program")}</label>
          <input
            value={program}
            placeholder={t("openwith.programPh")}
            onChange={(e) => setProgram(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") open(program.trim() || undefined);
            }}
            autoFocus
          />
        </div>
        <div className="form-row">
          <label>{t("openwith.remember")}</label>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
        </div>
        {err && <div className="form-row form-error">{err}</div>}
        <div className="btn-row">
          <button className="primary" onClick={() => open(program.trim() || undefined)}>
            {t("openwith.open")}
          </button>
          <button
            onClick={() => open(undefined)}
            title={t("openwith.systemDefault")}
          >
            {t("openwith.systemDefault")}
          </button>
          <button onClick={onClose}>{t("dlg.cancel")}</button>
        </div>
      </div>
    </Dialog>
  );
}
