/** WinM-style settings window (환경설정): 7 tabs, true modal. */
import React, { useEffect, useRef, useState } from "react";
import type { AppConfig, ExtAssoc } from "../lib/config";
import { defaultWinmSettings } from "../lib/config";
import { parseCol, serializeCol, DEFAULT_EXT_COLORS } from "../theme";
import "./settings.css";
import { WinButton, WinInput } from "./settings/controls";
import { TabFileWin, TabDisplay, TabProcess, type TabEnv } from "./settings/tabsA";
import { TabColor, TabArchive, TabProgram, TabEtc } from "./settings/tabsB";

interface SettingsDialogProps {
  config: AppConfig;
  onClose: () => void;
  onSave: (cfg: AppConfig, close: boolean, clearPaths?: boolean) => void;
}

const TABS = [
  { id: "filewin", label: "파일창", icon: "▤", comp: TabFileWin },
  { id: "display", label: "표시", icon: "☑", comp: TabDisplay },
  { id: "process", label: "처리", icon: "⚙", comp: TabProcess },
  { id: "color", label: "색깔", icon: "◈", comp: TabColor },
  { id: "archive", label: "압축파일", icon: "▦", comp: TabArchive },
  { id: "program", label: "프로그램", icon: "▶", comp: TabProgram },
  { id: "etc", label: "기타", icon: "✦", comp: TabEtc },
] as const;

type TabId = (typeof TABS)[number]["id"];

function readFile(file: File, encoding = "utf-8"): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsText(file, encoding);
  });
}

function download(name: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function PathPicker({
  initial, onOk, onCancel,
}: {
  initial: string; onOk: (v: string) => void; onCancel: () => void;
}) {
  const [v, setV] = useState(initial);
  return (
    <div className="set-subwindow" style={{ width: 440 }}>
      <div className="set-titlebar"><span>경로 입력</span></div>
      <div className="set-subbody">
        <div className="set-row">
          <WinInput value={v} onChange={setV} style={{ flex: 1 }} />
        </div>
        <div className="set-row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
          <WinButton onClick={() => onOk(v)}>확인</WinButton>
          <WinButton onClick={onCancel}>취소</WinButton>
        </div>
      </div>
    </div>
  );
}

function HelpSub({ onClose }: { onClose: () => void }) {
  return (
    <div className="set-subwindow" style={{ width: 440 }}>
      <div className="set-titlebar"><span>환경설정 도움말</span></div>
      <div className="set-subbody">
        <div className="set-note">
          파일창, 표시, 처리, 색깔, 압축파일, 프로그램, 기타 탭에서
          Mdir4의 동작 방식을 설정합니다.
        </div>
        <div className="set-note" style={{ marginTop: 6 }}>
          확인: 변경 내용을 저장하고 창을 닫습니다.
          <br />
          적용: 변경 내용을 저장하고 창을 열어 둡니다.
          <br />
          취소: 변경 내용을 버리고 창을 닫습니다.
        </div>
        <div className="set-row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
          <WinButton onClick={onClose}>닫기</WinButton>
        </div>
      </div>
    </div>
  );
}

const MANAGED_COLOR_KEYS = new Set([
  "--bg", "--fg", "--dir-fg", "--accent", "--cursor-bg", "--border",
  "--rowsep", "--info", "--hidden-fg", "--ro-fg", "--bigsize-fg",
  "--mcd-bg", "--mcd-fg",
]);

export default function SettingsDialog({ config, onClose, onSave }: SettingsDialogProps) {
  const [draft, setDraft] = useState<AppConfig>(() => ({
    ...config,
    // seed the extension-color list with built-in defaults so the 색깔 tab
    // shows (and can edit/delete) the effective colors, like WinM.
    customExtColors: { ...DEFAULT_EXT_COLORS, ...(config.customExtColors ?? {}) },
    winm: config.winm
      ? {
          ...defaultWinmSettings,
          ...config.winm,
          panel1: { ...defaultWinmSettings.panel1, ...config.winm.panel1 },
          panel2: { ...defaultWinmSettings.panel2, ...config.winm.panel2 },
          disp: { ...defaultWinmSettings.disp, ...config.winm.disp },
          proc: { ...defaultWinmSettings.proc, ...config.winm.proc },
          color: {
            ...defaultWinmSettings.color,
            ...config.winm.color,
            items: { ...defaultWinmSettings.color.items, ...config.winm.color?.items },
          },
          arc: { ...defaultWinmSettings.arc, ...config.winm.arc },
          prog: { ...defaultWinmSettings.prog, ...config.winm.prog },
          etc: { ...defaultWinmSettings.etc, ...config.winm.etc },
        }
      : defaultWinmSettings,
  }));
  const [tab, setTab] = useState<TabId>("filewin");
  const [sub, setSub] = useState<React.ReactNode | null>(null);
  const [pathsCleared, setPathsCleared] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const colInput = useRef<HTMLInputElement>(null);
  const cfgInput = useRef<HTMLInputElement>(null);
  const subRef = useRef(sub);
  subRef.current = sub;

  const closeSub = () => setSub(null);
  const openSub = (node: React.ReactNode) => setSub(node);

  /* Native dialog modal with focus trap + ESC handling */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Open as modal
    if (!dialog.open) {
      dialog.showModal();
    }

    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (subRef.current) setSub(null);
        else onClose();
        return;
      }
      if (e.key === "F1") {
        e.preventDefault();
        e.stopPropagation();
        setSub(<HelpSub onClose={() => setSub(null)} />);
        return;
      }
      if (e.key === "Tab") {
        const root = dialog;
        if (!root) return;
        const scope = (root.querySelector(".set-subwindow") as HTMLElement) ?? root;
        const els = [...scope.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), label.set-check, label.set-radio",
        )].filter((el) => el.offsetParent !== null && el.tabIndex >= 0);
        if (els.length === 0) return;
        const first = els[0];
        const last = els[els.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && (active === first || !scope.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", h, true);

    return () => {
      window.removeEventListener("keydown", h, true);
      if (dialog.open) {
        dialog.close();
      }
    };
  }, [onClose]);

  // initial focus: active tab
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLButtonElement>(".set-tab.active")?.focus();
  }, []);

  const pickPath = (initial: string, cb: (p: string) => void) =>
    openSub(
      <PathPicker
        initial={initial}
        onOk={(v) => { cb(v); closeSub(); }}
        onCancel={closeSub}
      />,
    );

  const setW: TabEnv["setW"] = (fn) =>
    setDraft((d) => ({ ...d, winm: fn(d.winm ?? defaultWinmSettings) }));
  const setAssoc = (assoc: ExtAssoc[]) => setDraft((d) => ({ ...d, assoc }));
  const setExtColors = (customExtColors: Record<string, string>) =>
    setDraft((d) => ({ ...d, customExtColors }));

  const importCol = () => colInput.current?.click();
  const onColFile = async (f: File) => {
    try {
      const text = await readFile(f, "euc-kr");
      const { vars, extColors } = parseCol(text);
      setDraft((d) => {
        const items = { ...(d.winm?.color.items ?? defaultWinmSettings.color.items) };
        for (const [k, v] of Object.entries(vars)) {
          if (MANAGED_COLOR_KEYS.has(k)) items[k] = v;
        }
        return {
          ...d,
          winm: { ...(d.winm ?? defaultWinmSettings), color: { ...(d.winm?.color ?? defaultWinmSettings.color), items } },
          customExtColors: { ...(d.customExtColors ?? {}), ...extColors },
        };
      });
    } catch {
      /* ignore */
    }
  };
  const exportCol = () =>
    download("mdir4.col", serializeCol(draft.winm?.color.items ?? {}, draft.customExtColors ?? {}));

  const importConfig = () => cfgInput.current?.click();
  const onCfgFile = async (f: File) => {
    try {
      const text = await readFile(f);
      const parsed = JSON.parse(text) as Partial<AppConfig>;
      setDraft((d) => ({
        ...d,
        ...parsed,
        customExtColors: { ...DEFAULT_EXT_COLORS, ...(parsed.customExtColors ?? {}) },
        winm: parsed.winm
          ? {
              ...defaultWinmSettings,
              ...parsed.winm,
              panel1: { ...defaultWinmSettings.panel1, ...parsed.winm.panel1 },
              panel2: { ...defaultWinmSettings.panel2, ...parsed.winm.panel2 },
              disp: { ...defaultWinmSettings.disp, ...parsed.winm.disp },
              proc: { ...defaultWinmSettings.proc, ...parsed.winm.proc },
              color: {
                ...defaultWinmSettings.color,
                ...parsed.winm.color,
                items: { ...defaultWinmSettings.color.items, ...parsed.winm.color?.items },
              },
              arc: { ...defaultWinmSettings.arc, ...parsed.winm.arc },
              prog: { ...defaultWinmSettings.prog, ...parsed.winm.prog },
              etc: { ...defaultWinmSettings.etc, ...parsed.winm.etc },
            }
          : d.winm,
      }));
    } catch {
      /* ignore */
    }
  };
  const exportConfig = () => download("mdir4-config.json", JSON.stringify(draft, null, 2));

  const clearPrevPaths = () => {
    setDraft((d) => ({ ...d, leftPath: undefined, rightPath: undefined }));
    setPathsCleared(true);
  };

  const env: TabEnv = {
    w: draft.winm ?? defaultWinmSettings,
    setW,
    assoc: draft.assoc,
    setAssoc,
    extColors: draft.customExtColors ?? {},
    setExtColors,
    pickPath,
    openSub,
    closeSub,
    importCol,
    exportCol,
    importConfig,
    exportConfig,
    clearPrevPaths,
  };

  const Active = TABS.find((t) => t.id === tab)!.comp;

  return (
    <>
      <dialog ref={dialogRef} className="set-window" aria-label="환경설정">
        <div className="set-titlebar">
          <span>환경설정</span>
          <button className="set-x" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <div className="set-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`set-tab${tab === t.id ? " active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <span className="ticon" aria-hidden>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
        <div className="set-page" role="tabpanel">
          <Active {...env} />
        </div>
        <div className="set-bottom">
          <WinButton onClick={() => openSub(<HelpSub onClose={closeSub} />)}>도움말(F1)</WinButton>
          <div className="right">
            <WinButton onClick={() => onSave(draft, true, pathsCleared)}>확인</WinButton>
            <WinButton onClick={onClose}>취소</WinButton>
            <WinButton onClick={() => onSave(draft, false, pathsCleared)}>적용</WinButton>
          </div>
        </div>
        {sub && (
          <div className="set-suboverlay" onMouseDown={(e) => e.stopPropagation()}>
            {sub}
          </div>
        )}
      </dialog>
      <input
        ref={colInput}
        type="file"
        accept=".col"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onColFile(f);
          e.target.value = "";
        }}
      />
      <input
        ref={cfgInput}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onCfgFile(f);
          e.target.value = "";
        }}
      />
    </>
  );
}
