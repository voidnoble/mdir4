import { useRef, useState } from "react";
import Dialog from "../components/Dialog";
import { useT } from "../i18n";
import { lngToDict, parseLng } from "../i18n/lng";
import type { AppConfig, ExtAssoc } from "../lib/config";
import { parseCol } from "../theme";

interface SettingsDialogProps {
  config: AppConfig;
  onClose: () => void;
  onSave: (cfg: AppConfig) => void;
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("read failed"));
    // WinM .lng/.col are EUC-KR encoded; decode leniently
    r.readAsText(file, "euc-kr");
  });
}

export default function SettingsDialog({ config, onClose, onSave }: SettingsDialogProps) {
  const t = useT();
  const [draft, setDraft] = useState<AppConfig>({ ...config });
  const lngInput = useRef<HTMLInputElement>(null);
  const colInput = useRef<HTMLInputElement>(null);
  const [assocExt, setAssocExt] = useState("");
  const [assocProg, setAssocProg] = useState("");

  const set = <K extends keyof AppConfig>(k: K, v: AppConfig[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const loadLng = async (f: File) => {
    try {
      const text = await readFile(f);
      const dict = lngToDict(parseLng(text));
      setDraft((d) => ({
        ...d,
        lang: "custom",
        customLang: dict,
        customLangName: f.name,
      }));
    } catch {
      /* ignore */
    }
  };

  const loadCol = async (f: File) => {
    try {
      const text = await readFile(f);
      const { vars, extColors } = parseCol(text);
      setDraft((d) => ({
        ...d,
        theme: "custom",
        customThemeCss: vars,
        customExtColors: extColors,
        customThemeName: f.name,
      }));
    } catch {
      /* ignore */
    }
  };

  return (
    <Dialog title={t("settings.title")} onClose={onClose}>
      <div className="form">
        <div className="form-row">
          <label>{t("settings.lang")}</label>
          <div className="radio-group">
            <label>
              <input type="radio" checked={draft.lang === "ko"} onChange={() => set("lang", "ko")} />
              {t("settings.langKo")}
            </label>
            <label>
              <input type="radio" checked={draft.lang === "en"} onChange={() => set("lang", "en")} />
              {t("settings.langEn")}
            </label>
            <label>
              <input
                type="radio"
                checked={draft.lang === "custom"}
                onChange={() => set("lang", "custom")}
              />
              {t("settings.langCustom")}
              {draft.customLangName && draft.lang === "custom" && (
                <span className="muted"> ({t("settings.loaded", { name: draft.customLangName })})</span>
              )}
            </label>
            <button className="link-btn" onClick={() => lngInput.current?.click()}>
              {t("settings.loadLng")}
            </button>
            <input
              ref={lngInput}
              type="file"
              accept=".lng"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadLng(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>
        <div className="form-row">
          <label>{t("settings.theme")}</label>
          <div className="radio-group">
            <label>
              <input type="radio" checked={draft.theme === "dark"} onChange={() => set("theme", "dark")} />
              {t("settings.themeDark")}
            </label>
            <label>
              <input type="radio" checked={draft.theme === "light"} onChange={() => set("theme", "light")} />
              {t("settings.themeLight")}
            </label>
            <label>
              <input
                type="radio"
                checked={draft.theme === "custom"}
                onChange={() => set("theme", "custom")}
              />
              {t("settings.themeCustom")}
              {draft.customThemeName && draft.theme === "custom" && (
                <span className="muted"> ({t("settings.loaded", { name: draft.customThemeName })})</span>
              )}
            </label>
            <button className="link-btn" onClick={() => colInput.current?.click()}>
              {t("settings.loadCol")}
            </button>
            <input
              ref={colInput}
              type="file"
              accept=".col"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadCol(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>
        <div className="form-row">
          <label>{t("menu.view")}</label>
          <div className="radio-group">
            <label>
              <input
                type="checkbox"
                checked={draft.showHidden}
                onChange={(e) => set("showHidden", e.target.checked)}
              />
              {t("settings.showHidden")}
            </label>
          </div>
        </div>
        <div className="form-row">
          <label>{t("del.start")}</label>
          <div className="radio-group">
            <label>
              <input
                type="checkbox"
                checked={draft.useTrash}
                onChange={(e) => set("useTrash", e.target.checked)}
              />
              {t("settings.useTrash")}
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.confirmDelete}
                onChange={(e) => set("confirmDelete", e.target.checked)}
              />
              {t("settings.confirmDelete")}
            </label>
          </div>
        </div>
        <div className="form-row">
          <label>{t("settings.assoc")}</label>
          <div className="assoc-list">
            {draft.assoc.length === 0 && <span className="muted">{t("settings.assocEmpty")}</span>}
            {draft.assoc.map((a) => (
              <div key={a.ext} className="assoc-row" title={a.program || t("openwith.systemDefault")}>
                <span className="assoc-ext">{a.ext}</span>
                <span className="assoc-prog">{a.program || t("openwith.systemDefault")}</span>
                <button
                  className="link-btn"
                  onClick={() =>
                    set(
                      "assoc",
                      draft.assoc.filter((x) => x.ext !== a.ext),
                    )
                  }
                >
                  {t("dlg.delete")}
                </button>
              </div>
            ))}
            <div className="assoc-add">
              <input
                value={assocExt}
                placeholder=".txt"
                style={{ width: 70 }}
                onChange={(e) => setAssocExt(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
              />
              <input
                value={assocProg}
                placeholder={t("settings.assocProgPh")}
                onChange={(e) => setAssocProg(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
              />
              <button
                className="link-btn"
                onClick={() => {
                  let ext = assocExt.trim().toLowerCase();
                  if (!ext) return;
                  if (!ext.startsWith(".")) ext = "." + ext;
                  const next: ExtAssoc[] = draft.assoc.filter((x) => x.ext !== ext);
                  next.push({ ext, program: assocProg.trim() });
                  set("assoc", next);
                  setAssocExt("");
                  setAssocProg("");
                }}
              >
                {t("dlg.add")}
              </button>
            </div>
          </div>
        </div>
        <div className="form-row">
          <label>{t("settings.extPacker")}</label>
          <div className="radio-group" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <label className="extpack-row">
              <span style={{ minWidth: 90 }}>{t("settings.extPackerPack")}</span>
              <input
                value={draft.extPacker}
                placeholder={t("settings.extPackerPh")}
                onChange={(e) => set("extPacker", e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                style={{ flex: 1 }}
              />
            </label>
            <label className="extpack-row">
              <span style={{ minWidth: 90 }}>{t("settings.extPackerUnpack")}</span>
              <input
                value={draft.extUnpacker}
                placeholder={t("settings.extUnpackerPh")}
                onChange={(e) => set("extUnpacker", e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                style={{ flex: 1 }}
              />
            </label>
            <span className="muted">{t("settings.extPackerHint")}</span>
          </div>
        </div>
        <div className="btn-row">
          <button className="primary" onClick={() => onSave(draft)}>
            {t("dlg.save")}
          </button>
          <button onClick={onClose}>{t("dlg.cancel")}</button>
        </div>
      </div>
    </Dialog>
  );
}
