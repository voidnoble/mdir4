import { useMemo, useState } from "react";
import Dialog from "../components/Dialog";
import { useT } from "../i18n";
import type { CaseMode, RenamePair, RenameRule } from "../lib/rename";
import { findDupes, previewBatch } from "../lib/rename";
import { fsRename } from "../lib/fs";
import { baseName, joinPath, parentDir } from "../lib/path";

interface BatchRenameDialogProps {
  files: { path: string; name: string }[];
  onClose: () => void;
  onDone: () => void;
}

/** WinM TRenameForm: pattern/counter/date batch rename with preview + undo. */
export default function BatchRenameDialog({ files, onClose, onDone }: BatchRenameDialogProps) {
  const t = useT();
  const [pattern, setPattern] = useState("<name>_<num:3><ext>");
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [caseMode, setCaseMode] = useState<CaseMode>("keep");
  const [startNum, setStartNum] = useState(1);
  const [step, setStep] = useState(1);
  const [undoStack, setUndoStack] = useState<RenamePair[][]>([]);
  const [busy, setBusy] = useState(false);
  // Local copy of the file list so the preview stays fresh after apply/undo.
  const [curFiles, setCurFiles] = useState(files);

  const rule: RenameRule = useMemo(
    () => ({ pattern, find, replace, caseMode, startNum, step }),
    [pattern, find, replace, caseMode, startNum, step],
  );

  const preview = useMemo(
    () => previewBatch(curFiles.map((f) => f.name), rule),
    [curFiles, rule],
  );
  const dupes = useMemo(() => findDupes(preview), [preview]);
  const hasDupe = dupes.size > 0;

  const apply = async () => {
    if (hasDupe || busy) return;
    setBusy(true);
    try {
      const done: RenamePair[] = [];
      const next = [...curFiles];
      for (let i = 0; i < curFiles.length; i++) {
        const to = preview[i].to;
        if (curFiles[i].name === to) continue;
        await fsRename(curFiles[i].path, to);
        const newPath = joinPath(parentDir(curFiles[i].path), to);
        done.push({ from: curFiles[i].path, to: newPath });
        next[i] = { path: newPath, name: to };
      }
      if (done.length > 0) {
        setUndoStack((s) => [...s, done.map((d) => ({ from: d.to, to: d.from }))].slice(-10));
        setCurFiles(next);
      }
      onDone();
    } catch {
      // partial failures: refresh and let the user inspect
      onDone();
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    const last = undoStack[undoStack.length - 1];
    if (!last || busy) return;
    setBusy(true);
    try {
      const next = [...curFiles];
      for (const p of last) {
        // p.from = full new path, p.to = full old path
        await fsRename(p.from, baseName(p.to)).catch(() => {});
        const idx = next.findIndex((f) => f.path === p.from);
        if (idx >= 0) next[idx] = { path: p.to, name: baseName(p.to) };
      }
      setCurFiles(next);
      setUndoStack((s) => s.slice(0, -1));
      onDone();
    } finally {
      setBusy(false);
    }
  };

  const cases: { v: CaseMode; label: string }[] = [
    { v: "keep", label: t("rnm2.caseKeep") },
    { v: "upper", label: t("rnm2.caseUpper") },
    { v: "lower", label: t("rnm2.caseLower") },
    { v: "cap", label: t("rnm2.caseCap") },
  ];

  return (
    <Dialog title={t("rnm2.title")} onClose={onClose} wide>
      <div className="form">
        <div className="form-row">
          <label>{t("rnm2.pattern")}</label>
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            spellCheck={false}
          />
        </div>
        <div className="hint">{t("rnm2.help")}</div>
        <div className="form-grid2">
          <div className="form-row">
            <label>{t("rnm2.find")}</label>
            <input value={find} onChange={(e) => setFind(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
          </div>
          <div className="form-row">
            <label>{t("rnm2.replace")}</label>
            <input value={replace} onChange={(e) => setReplace(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
          </div>
          <div className="form-row">
            <label>{t("rnm2.case")}</label>
            <select value={caseMode} onChange={(e) => setCaseMode(e.target.value as CaseMode)}>
              {cases.map((c) => (
                <option key={c.v} value={c.v}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>{t("rnm2.counter")}</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="number"
                value={startNum}
                onChange={(e) => setStartNum(parseInt(e.target.value, 10) || 0)}
                onKeyDown={(e) => e.stopPropagation()}
                style={{ width: 70 }}
              />
              <span className="hint">{t("rnm2.step")}</span>
              <input
                type="number"
                value={step}
                onChange={(e) => setStep(parseInt(e.target.value, 10) || 1)}
                onKeyDown={(e) => e.stopPropagation()}
                style={{ width: 60 }}
              />
            </div>
          </div>
        </div>
        <div className="zip-list" style={{ maxHeight: 220 }}>
          {preview.map((p, i) => (
            <div key={i} className={`zip-row${dupes.has(i) ? " dupe" : ""}`} title={`${p.from} → ${p.to}`}>
              <span className="zip-name">{p.from}</span>
              <span className="zip-name">→</span>
              <span className="zip-name">{p.to}</span>
            </div>
          ))}
          {preview.length === 0 && <div className="hint">{t("rnm2.empty")}</div>}
        </div>
        {hasDupe && <div className="warn">⚠ {t("rnm2.dupeWarn")}</div>}
        <div className="btn-row">
          <button className="primary" onClick={() => void apply()} disabled={hasDupe || busy || preview.length === 0}>
            {t("rnm2.apply")}
          </button>
          <button onClick={() => void undo()} disabled={undoStack.length === 0 || busy}>
            {t("rnm2.undo")}
          </button>
          <button onClick={onClose}>{t("dlg.close")}</button>
        </div>
      </div>
    </Dialog>
  );
}
