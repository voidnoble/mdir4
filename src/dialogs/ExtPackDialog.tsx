import { useState } from "react";
import Dialog from "../components/Dialog";
import { useT } from "../i18n";
import { fsExec } from "../lib/fs";
import { baseName } from "../lib/path";

interface ExtPackDialogProps {
  /** "pack" = compress sources, "unpack" = extract archive */
  mode: "pack" | "unpack";
  sources: string[];
  command: string;
  cwd: string;
  onClose: () => void;
  onDone: () => void;
}

/** Split a command line into program + args (simple quoting support). */
function splitCmd(cmd: string): { program: string; args: string[] } {
  const parts: string[] = [];
  let cur = "";
  let quote: string | null = null;
  for (const ch of cmd.trim()) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === " " || ch === "\t") {
      if (cur) {
        parts.push(cur);
        cur = "";
      }
    } else {
      cur += ch;
    }
  }
  if (cur) parts.push(cur);
  return { program: parts[0] ?? "", args: parts.slice(1) };
}

export default function ExtPackDialog({ mode, sources, command, cwd, onClose, onDone }: ExtPackDialogProps) {
  const t = useT();
  const [output, setOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [ok, setOk] = useState<boolean | null>(null);

  const run = async () => {
    const { program, args } = splitCmd(command);
    if (!program) return;
    setRunning(true);
    setOutput(null);
    try {
      const r = await fsExec(program, [...args, ...sources], cwd);
      setOk(r.code === 0);
      const text = [r.stdout, r.stderr].filter(Boolean).join("\n");
      setOutput(text || t("extpack.emptyOut"));
      if (r.code === 0) onDone();
    } catch (e) {
      setOk(false);
      setOutput(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const { program, args } = splitCmd(command);
  const fullCmd = [program, ...args, ...sources.map((s) => `"${baseName(s)}"`)].join(" ");

  return (
    <Dialog title={t(mode === "pack" ? "extpack.titlePack" : "extpack.titleUnpack")} onClose={onClose}>
      <div className="form">
        <div className="form-row">
          <label>{t("extpack.command")}</label>
          <div className="src-list">
            <div title={fullCmd} style={{ wordBreak: "break-all" }}>
              {fullCmd}
            </div>
          </div>
        </div>
        <div className="form-row">
          <label>{t("dlg.itemsLabel")}</label>
          <div className="src-list">
            {sources.slice(0, 5).map((s) => (
              <div key={s} title={s}>
                {baseName(s)}
              </div>
            ))}
            {sources.length > 5 && <div>{t("dlg.more", { n: sources.length - 5 })}</div>}
          </div>
        </div>
        {output !== null && (
          <div className="form-row">
            <label>{t("extpack.output")}</label>
            <pre className={`extpack-out${ok === false ? " err" : ""}`}>{output}</pre>
          </div>
        )}
        <div className="btn-row">
          {output === null ? (
            <button className="primary" onClick={run} disabled={running || !program}>
              {running ? t("dlg.preparing") : t("extpack.run")}
            </button>
          ) : (
            <button className="primary" onClick={onClose}>
              {t("dlg.close")}
            </button>
          )}
          {output === null && <button onClick={onClose}>{t("dlg.cancel")}</button>}
        </div>
      </div>
    </Dialog>
  );
}
