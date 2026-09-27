import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import Panel from "./components/Panel";
import Toolbar, { type ToolDef } from "./components/Toolbar";
import {
  ArchiveIcon,
  BookmarkIcon,
  CopyIcon,
  DeleteIcon,
  HelpIcon,
  MkdirIcon,
  MoveIcon,
  RefreshIcon,
  RenameIcon,
  SettingsIcon,
  TreeIcon,
} from "./components/icons";
import StatusBar from "./components/StatusBar";
import PathDialog from "./dialogs/PathDialog";
import DriveDialog from "./dialogs/DriveDialog";
import BatchRenameDialog from "./dialogs/BatchRenameDialog";
import CombineDialog from "./dialogs/CombineDialog";
import CopyDialog from "./dialogs/CopyDialog";
import DeleteDialog from "./dialogs/DeleteDialog";
import ExtPackDialog from "./dialogs/ExtPackDialog";
import McdDialog from "./dialogs/McdDialog";
import ExtractDialog from "./dialogs/ExtractDialog";
import ProgressDialog from "./dialogs/ProgressDialog";
import RenameDialog from "./dialogs/RenameDialog";
import QcdDialog from "./dialogs/QcdDialog";
import ResultDialog from "./dialogs/ResultDialog";
import SplitDialog from "./dialogs/SplitDialog";
import SettingsDialog from "./dialogs/SettingsDialog";
import ZipDialog, { defaultZipDest } from "./dialogs/ZipDialog";
import ZipViewDialog from "./dialogs/ZipViewDialog";
import FileListDialog from "./dialogs/FileListDialog";
import FilterDialog from "./dialogs/FilterDialog";
import HelpDialog from "./dialogs/HelpDialog";
import OpenWithDialog, { extOf } from "./dialogs/OpenWithDialog";
import PropsDialog from "./dialogs/PropsDialog";
import SelectDialog from "./dialogs/SelectDialog";
import { usePanel } from "./hooks/usePanel";
import { getLang, setLang, useT } from "./i18n";
import MenuBar from "./components/MenuBar";
import { buildWinMMenu, PROG_FILTER, ZIP_FILTER, type WinMItem, type WinMActions } from "./menus/winm";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { AppConfig, ExtAssoc, QcdEntry } from "./lib/config";
import { defaultConfig, defaultWinmSettings, loadConfig, saveConfig } from "./lib/config";
import { setDisplayOpts } from "./lib/format";
import type { OpSummary, OverwritePolicy } from "./lib/fs";
import {
  fsCombine,
  fsCopy,
  fsDelete,
  fsHome,
  fsMove,
  fsRename,
  fsRoots,
  fsShellOpen,
  fsSplit,
  fsZipCreate,
  fsZipExtract,
  isSplitPart,
  newOpId,
  unsplitName,
} from "./lib/fs";
import { baseName, joinPath } from "./lib/path";
import { applyCustomVars, setTheme } from "./theme";

type DialogState =
  | { kind: "copy"; mode: "copy" | "move"; sources: string[]; dest: string }
  | { kind: "delete"; paths: string[] }
  | { kind: "rename"; path: string; name: string }
  | { kind: "zip"; sources: string[]; dest: string }
  | { kind: "extPack"; mode: "pack" | "unpack"; sources: string[] }
  | { kind: "extract"; zipPath: string; dest: string }
  | { kind: "zipview"; zipPath: string }
  | { kind: "settings" }
  | { kind: "mcd" }
  | { kind: "qcd" }
  | { kind: "drive" }
  | { kind: "path" }
  | { kind: "split"; path: string; dest: string }
  | { kind: "combine"; firstPart: string; dest: string }
  | { kind: "batchRename"; files: { path: string; name: string }[] }
  | { kind: "props"; path: string; dir: string; name: string }
  | { kind: "filter" }
  | { kind: "select"; select: boolean }
  | { kind: "help" }
  | { kind: "fileList" }
  | { kind: "openWith"; path: string }
  | { kind: "progress"; opId: string; title: string }
  | { kind: "result"; title: string; summary: OpSummary }
  | null;

function failedSummary(opId: string, op: string, message: string): OpSummary {
  return {
    opId,
    op,
    filesDone: 0,
    filesTotal: 0,
    bytesDone: 0,
    bytesTotal: 0,
    skipped: [],
    errors: [message],
    cancelled: false,
  };
}

function errMsg(e: unknown): string {
  if (typeof e === "object" && e && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

/** Logical letter for Alt/Option+key combos (Windows Alt == macOS Option).
 *  On Windows Alt+C gives e.key="c"; on macOS Option(⌥) also sets altKey but
 *  ⌥C yields a composed char ("ç"), so fall back to the physical key code. */
function comboLetter(e: KeyboardEvent): string {
  const k = e.key.length === 1 ? e.key.toLowerCase() : "";
  if (/^[a-z]$/.test(k) || k === "-") return k;
  const m = /^Key([A-Z])$/.exec(e.code);
  if (m) return m[1].toLowerCase();
  if (e.code === "Minus") return "-";
  return k;
}

function App() {
  const t = useT();
  const left = usePanel("/");
  const right = usePanel("/");
  const [active, setActive] = useState<0 | 1>(0);
  const [ready, setReady] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  // WinM 보기 메뉴 toggles (chrome visibility) + 줄간격 (row height)
  const [showToolbar, setShowToolbar] = useState(true);
  const [showPathbar, setShowPathbar] = useState(true);
  const [showColHeader, setShowColHeader] = useState(true);
  const [showStatusbar, setShowStatusbar] = useState(true);
  // panel layout: "single" (default) | "vertical" | "horizontal" (보기 > 창)
  const [layout, setLayoutState] = useState<"single" | "vertical" | "horizontal">("single");
  // per-panel visibility from the settings window (master toggles above)
  const [colHeaderL, setColHeaderL] = useState(true);
  const [colHeaderR, setColHeaderR] = useState(true);
  const [pathbarL, setPathbarL] = useState(true);
  const [pathbarR, setPathbarR] = useState(true);
  const [statusbarL, setStatusbarL] = useState(true);
  const [statusbarR, setStatusbarR] = useState(true);
  const [rowH, setRowH] = useState(26);
  const dialogRef = useRef(dialog);
  dialogRef.current = dialog;
  const panelsRef = useRef({ left, right, active });
  panelsRef.current = { left, right, active };
  const configRef = useRef(config);
  configRef.current = config;

  const applyConfig = useCallback(
    (cfg: AppConfig) => {
      setConfig(cfg);
      setLang(cfg.lang, cfg.customLang ?? null);
      if (cfg.theme === "custom") {
        applyCustomVars(cfg.customThemeCss ?? {});
      } else {
        setTheme(cfg.theme);
      }
      // WinM settings window values
      const w = cfg.winm ?? defaultWinmSettings;
      setDisplayOpts({
        hour24: w.disp.hour24,
        year4: w.disp.year4,
        sizeUnit: w.disp.sizeUnit,
      });
      if (w.color.enabled) applyCustomVars(w.color.items);
      const rs = document.documentElement.style;
      const setFont = (key: string, name: string, size: number) => {
        if (name) {
          rs.setProperty(`--${key}-font`, `"${name}", "Malgun Gothic", sans-serif`);
          rs.setProperty(`--${key}-size`, `${size}px`);
        }
      };
      setFont("filewin", w.disp.filewinFont.name, w.disp.filewinFont.size);
      setFont("mcd", w.disp.mcdFont.name, w.disp.mcdFont.size);
      setColHeaderL(w.panel1.showHeader);
      setColHeaderR(w.panel2.showHeader);
      setPathbarL(w.panel1.showPathBar);
      setPathbarR(w.panel2.showPathBar);
      setStatusbarL(w.panel1.showStatusBar);
      setStatusbarR(w.panel2.showStatusBar);
      setLayoutState(cfg.layout ?? "single");
    },
    [],
  );

  const SORT_BY_MAP: Record<string, "name" | "ext" | "size" | "mtime"> = {
    "이름": "name",
    "확장자": "ext",
    "크기": "size",
    "날짜": "mtime",
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cfg = await loadConfig();
      if (cancelled) return;
      applyConfig(cfg);
      const w = cfg.winm ?? defaultWinmSettings;
      const sortL = SORT_BY_MAP[w.panel1.sortBy] ?? "ext";
      const sortR = SORT_BY_MAP[w.panel2.sortBy] ?? "ext";
      panelsRef.current.left.setShowHidden(w.panel1.showHidden);
      panelsRef.current.right.setShowHidden(w.panel2.showHidden);
      panelsRef.current.left.setSort(sortL, w.panel1.sortAsc ? "asc" : "desc");
      panelsRef.current.right.setSort(sortR, w.panel2.sortAsc ? "asc" : "desc");
      const home = await fsHome().catch(() => "/");
      if (cancelled) return;
      // start paths: fixed path / WinM default / last-used folder
      const startPath = (side: "left" | "right") => {
        if (w.etc.startMode === "path" && w.etc.startPath) return w.etc.startPath;
        const saved = side === "left" ? cfg.leftPath : cfg.rightPath;
        if (saved && w.etc.noNetStart && /^\\\\/.test(saved)) return home;
        return saved ?? home;
      };
      panelsRef.current.left.load(startPath("left"));
      panelsRef.current.right.load(startPath("right"));
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist panel paths (debounced); skipped when the settings window's
  // "환경 자동 저장" is off, or "WinM 종료시 이전 경로 삭제" is on.
  useEffect(() => {
    if (!ready) return;
    const w = configRef.current.winm;
    if (w && (w.etc.autoSave === false || w.etc.clearPrevOnExit)) return;
    const id = window.setTimeout(() => {
      const cfg = { ...configRef.current, leftPath: left.state.path, rightPath: right.state.path };
      configRef.current = cfg;
      saveConfig(cfg).catch(() => {});
    }, 800);
    return () => window.clearTimeout(id);
  }, [ready, left.state.path, right.state.path]);

  const persistConfig = useCallback((cfg: AppConfig, snapshotPaths = true) => {
    const merged = {
      ...configRef.current,
      ...cfg,
      // the settings window's "이전 경로 삭제" must survive: don't re-snapshot
      // the live panel paths when the caller explicitly dropped them.
      ...(snapshotPaths
        ? { leftPath: panelsRef.current.left.state.path, rightPath: panelsRef.current.right.state.path }
        : {}),
    };
    configRef.current = merged;
    saveConfig(merged).catch(() => {});
  }, []);

  /** 보기 > 창: 단일/수직분할/수평분할 (메뉴 액션 + Ctrl+1/2/3 공용) */
  const applyLayout = useCallback((m: "single" | "vertical" | "horizontal") => {
    setLayoutState(m);
    persistConfig({ ...configRef.current, layout: m });
  }, [persistConfig]);

  const saveSettings = useCallback(
    (cfg: AppConfig, close: boolean, clearPaths?: boolean) => {
      const w = cfg.winm ?? defaultWinmSettings;
      // derive the legacy fields from the WinM settings window values
      const dropPaths = clearPaths || w.etc.clearPrevOnExit;
      const merged: AppConfig = {
        ...cfg,
        showHidden: w.panel1.showHidden || w.panel2.showHidden,
        useTrash: !w.proc.noTrash,
        leftPath: dropPaths ? undefined : panelsRef.current.left.state.path,
        rightPath: dropPaths ? undefined : panelsRef.current.right.state.path,
      };
      applyConfig(merged);
      persistConfig(merged, !dropPaths);
      // per-panel sort order + hidden filter
      const sortL = SORT_BY_MAP[w.panel1.sortBy] ?? "ext";
      const sortR = SORT_BY_MAP[w.panel2.sortBy] ?? "ext";
      panelsRef.current.left.setSort(sortL, w.panel1.sortAsc ? "asc" : "desc");
      panelsRef.current.right.setSort(sortR, w.panel2.sortAsc ? "asc" : "desc");
      panelsRef.current.left.setShowHidden(w.panel1.showHidden);
      panelsRef.current.right.setShowHidden(w.panel2.showHidden);
      if (close) setDialog(null);
    },
    [applyConfig, persistConfig],
  );

  const refreshBoth = useCallback(() => {
    panelsRef.current.left.refresh();
    panelsRef.current.right.refresh();
  }, []);

  /** ---- operations ---- */

  const openCopy = useCallback((mode: "copy" | "move") => {
    const { left, right, active } = panelsRef.current;
    const src = active === 0 ? left : right;
    const dst = active === 0 ? right : left;
    const targets = src.getTargets();
    if (targets.length === 0) return;
    setDialog({ kind: "copy", mode, sources: targets, dest: dst.state.path });
  }, []);

  const startCopyMove = useCallback(
    async (destDir: string, policy: OverwritePolicy) => {
      const d = dialogRef.current;
      if (d?.kind !== "copy") return;
      const opId = newOpId();
      const op = d.mode;
      const title = t(op === "copy" ? "copy.progressTitle" : "copy.progressTitleMove");
      const resultTitle = t(op === "copy" ? "copy.resultTitle" : "copy.resultTitleMove");
      const failTitle = t(op === "copy" ? "copy.failTitle" : "copy.failTitleMove");
      setDialog({ kind: "progress", opId, title });
      try {
        const summary =
          op === "copy"
            ? await fsCopy(d.sources, destDir, policy, opId)
            : await fsMove(d.sources, destDir, policy, opId);
        if (summary.errors.length > 0 || summary.cancelled || summary.skipped.length > 0) {
          setDialog({ kind: "result", title: resultTitle, summary });
        } else {
          setDialog(null);
        }
      } catch (e) {
        setDialog({ kind: "result", title: failTitle, summary: failedSummary(opId, op, errMsg(e)) });
      } finally {
        refreshBoth();
      }
    },
    [refreshBoth, t],
  );

  const runDelete = useCallback(
    async (paths: string[], permanent: boolean) => {
      const opId = newOpId();
      setDialog({ kind: "progress", opId, title: t("del.progressTitle") });
      try {
        const summary = await fsDelete(paths, permanent, opId);
        if (summary.errors.length > 0 || summary.cancelled) {
          setDialog({ kind: "result", title: t("del.resultTitle"), summary });
        } else {
          setDialog(null);
        }
      } catch (e) {
        setDialog({ kind: "result", title: t("del.failTitle"), summary: failedSummary(opId, "delete", errMsg(e)) });
      } finally {
        refreshBoth();
      }
    },
    [refreshBoth, t],
  );

  const openDelete = useCallback(() => {
    const { left, right, active } = panelsRef.current;
    const src = active === 0 ? left : right;
    const targets = src.getTargets();
    if (targets.length === 0) return;
    if (configRef.current.confirmDelete) {
      setDialog({ kind: "delete", paths: targets });
    } else {
      void runDelete(targets, !configRef.current.useTrash);
    }
  }, [runDelete]);

  const startDelete = useCallback(
    async (permanent: boolean) => {
      const d = dialogRef.current;
      if (d?.kind !== "delete") return;
      await runDelete(d.paths, permanent);
    },
    [runDelete],
  );

  const openRename = useCallback(() => {
    const { left, right, active } = panelsRef.current;
    const p = active === 0 ? left : right;
    const e = p.state.entries[p.state.cursor];
    if (!e) return;
    setDialog({ kind: "rename", path: e.path, name: e.name });
  }, []);

  const submitRename = useCallback(
    async (newName: string) => {
      const d = dialogRef.current;
      if (d?.kind !== "rename") return;
      setDialog(null);
      try {
        await fsRename(d.path, newName);
      } catch (e) {
        console.warn("rename failed", e);
      } finally {
        refreshBoth();
      }
    },
    [refreshBoth],
  );

  /** ---- archive ---- */

  const cursorEntry = useCallback(() => {
    const { left, right, active } = panelsRef.current;
    const p = active === 0 ? left : right;
    return p.state.entries[p.state.cursor] ?? null;
  }, []);

  const openZip = useCallback(() => {
    const { left, right, active } = panelsRef.current;
    const src = active === 0 ? left : right;
    const dst = active === 0 ? right : left;
    const targets = src.getTargets();
    if (targets.length === 0) return;
    setDialog({ kind: "zip", sources: targets, dest: defaultZipDest(targets, dst.state.path) });
  }, []);

  const openZipView = useCallback(() => {
    const e = cursorEntry();
    if (e && !e.isDir && e.name.toLowerCase().endsWith(".zip")) {
      setDialog({ kind: "zipview", zipPath: e.path });
    }
  }, [cursorEntry]);

  const openExtract = useCallback(
    (zipPath?: string) => {
      const zp = zipPath ?? cursorEntry()?.path;
      if (!zp || !zp.toLowerCase().endsWith(".zip")) return;
      const { left, right, active } = panelsRef.current;
      const p = active === 0 ? left : right;
      setDialog({ kind: "extract", zipPath: zp, dest: p.state.path });
    },
    [cursorEntry],
  );

  const startZip = useCallback(
    async (destZip: string) => {
      const d = dialogRef.current;
      if (d?.kind !== "zip") return;
      const opId = newOpId();
      setDialog({ kind: "progress", opId, title: t("zip.progressTitle") });
      try {
        const summary = await fsZipCreate(d.sources, destZip, opId);
        if (summary.errors.length > 0 || summary.cancelled) {
          setDialog({ kind: "result", title: t("zip.resultTitle"), summary });
        } else {
          setDialog(null);
        }
      } catch (e) {
        setDialog({ kind: "result", title: t("zip.failTitle"), summary: failedSummary(opId, "zip", errMsg(e)) });
      } finally {
        refreshBoth();
      }
    },
    [refreshBoth, t],
  );

  const startExtract = useCallback(
    async (destDir: string, policy: OverwritePolicy) => {
      const d = dialogRef.current;
      if (d?.kind !== "extract") return;
      const opId = newOpId();
      setDialog({ kind: "progress", opId, title: t("extract.progressTitle") });
      try {
        const summary = await fsZipExtract(d.zipPath, destDir, policy, opId);
        if (summary.errors.length > 0 || summary.cancelled || summary.skipped.length > 0) {
          setDialog({ kind: "result", title: t("extract.resultTitle"), summary });
        } else {
          setDialog(null);
        }
      } catch (e) {
        setDialog({ kind: "result", title: t("extract.failTitle"), summary: failedSummary(opId, "unzip", errMsg(e)) });
      } finally {
        refreshBoth();
      }
    },
    [refreshBoth, t],
  );

  const openSettings = useCallback(() => setDialog({ kind: "settings" }), []);

  /** ---- MCD / QCD ---- */

  const openMcd = useCallback(() => setDialog({ kind: "mcd" }), []);
  const selectMcd = useCallback((path: string) => {
    const { left, right, active } = panelsRef.current;
    (active === 0 ? left : right).load(path);
    setDialog(null);
  }, []);

  const openQcd = useCallback(() => setDialog({ kind: "qcd" }), []);

  const openDrive = useCallback(() => setDialog({ kind: "drive" }), []);

  const selectDrive = useCallback((path: string) => {
    const { left, right, active } = panelsRef.current;
    (active === 0 ? left : right).load(path);
    setDialog(null);
  }, []);

  // WinM menu actions: select entries sharing the cursor entry's extension/name
  const selectSameExt = useCallback(() => {
    const { left, right, active } = panelsRef.current;
    const panel = active === 0 ? left : right;
    const ce = cursorEntry();
    if (!ce || ce.isDir) return;
    const dot = ce.name.lastIndexOf(".");
    if (dot > 0) panel.selectByPattern(`*${ce.name.slice(dot)}`, true);
  }, [cursorEntry]);

  const selectSameName = useCallback(() => {
    const { left, right, active } = panelsRef.current;
    const panel = active === 0 ? left : right;
    const ce = cursorEntry();
    if (!ce || ce.isDir) return;
    const dot = ce.name.lastIndexOf(".");
    const base = dot > 0 ? ce.name.slice(0, dot) : ce.name;
    if (base) panel.selectByPattern(`${base}.*`, true);
  }, [cursorEntry]);

  const goRoot = useCallback(() => {
    const { left, right, active } = panelsRef.current;
    void fsRoots().then((roots) => {
      if (roots.length > 0) (active === 0 ? left : right).load(roots[0].path);
    });
  }, []);

  const quitApp = useCallback(() => {
    try {
      void getCurrentWindow().close().catch(() => window.close());
    } catch {
      window.close();
    }
  }, []);

  const setLangUi = useCallback(
    (l: "ko" | "en") => {
      const cfg = { ...configRef.current, lang: l };
      applyConfig(cfg);
      persistConfig(cfg);
    },
    [applyConfig, persistConfig],
  );

  const jumpQcd = useCallback(
    (path: string) => {
      selectMcd(path);
    },
    [selectMcd],
  );

  const saveQcd = useCallback(
    (entries: QcdEntry[]) => {
      persistConfig({ ...configRef.current, qcd: entries });
    },
    [persistConfig],
  );

  /** ---- split / combine ---- */

  const openSplitCombine = useCallback(() => {
    const { left, right, active } = panelsRef.current;
    const src = active === 0 ? left : right;
    const dst = active === 0 ? right : left;
    const e = src.state.entries[src.state.cursor];
    if (!e || e.isDir) return;
    if (isSplitPart(e.name)) {
      const dest = joinPath(dst.state.path, unsplitName(e.name));
      setDialog({ kind: "combine", firstPart: e.path, dest });
    } else {
      setDialog({ kind: "split", path: e.path, dest: dst.state.path });
    }
  }, []);

  const okSummary = (opId: string, op: string, files: number): OpSummary => ({
    opId,
    op,
    filesDone: files,
    filesTotal: files,
    bytesDone: 0,
    bytesTotal: 0,
    skipped: [],
    errors: [],
    cancelled: false,
  });

  const startSplit = useCallback(
    async (destDir: string, chunkSize: number) => {
      const d = dialogRef.current;
      if (d?.kind !== "split") return;
      const opId = newOpId();
      setDialog({ kind: "progress", opId, title: t("split.progressTitle") });
      try {
        const parts = await fsSplit(d.path, destDir, chunkSize, opId);
        setDialog({
          kind: "result",
          title: t("split.resultTitle"),
          summary: okSummary(opId, "split", parts.length),
        });
      } catch (e) {
        setDialog({
          kind: "result",
          title: t("split.failTitle"),
          summary: failedSummary(opId, "split", errMsg(e)),
        });
      } finally {
        refreshBoth();
      }
    },
    [refreshBoth, t],
  );

  const startCombine = useCallback(
    async (destPath: string) => {
      const d = dialogRef.current;
      if (d?.kind !== "combine") return;
      const opId = newOpId();
      setDialog({ kind: "progress", opId, title: t("combine.progressTitle") });
      try {
        await fsCombine(d.firstPart, destPath, opId);
        setDialog({
          kind: "result",
          title: t("combine.resultTitle"),
          summary: okSummary(opId, "combine", 1),
        });
      } catch (e) {
        setDialog({
          kind: "result",
          title: t("combine.failTitle"),
          summary: failedSummary(opId, "combine", errMsg(e)),
        });
      } finally {
        refreshBoth();
      }
    },
    [refreshBoth, t],
  );

  /** ---- advanced rename ---- */

  const openBatchRename = useCallback(() => {
    const { left, right, active } = panelsRef.current;
    const p = active === 0 ? left : right;
    const targets = p.getTargets();
    if (targets.length === 0) return;
    const byPath = new Map(p.state.entries.map((e) => [e.path, e.name]));
    const files = targets.map((path) => ({ path, name: byPath.get(path) ?? baseName(path) }));
    setDialog({ kind: "batchRename", files });
  }, []);

  /** ---- P6: props / filter / select / help / file list / open ---- */

  const openProps = useCallback(() => {
    const ce = cursorEntry();
    if (!ce) return;
    const { left, right, active } = panelsRef.current;
    const p = active === 0 ? left : right;
    setDialog({ kind: "props", path: ce.path, dir: p.state.path, name: ce.name });
  }, [cursorEntry]);

  const openWithDefault = useCallback(async (forcedProg?: string) => {
    const ce = cursorEntry();
    if (!ce || ce.isDir) return;
    const cfg = configRef.current;
    const prog = forcedProg || cfg.assoc.find((a) => a.ext === extOf(ce.name))?.program || undefined;
    try {
      await fsShellOpen(ce.path, prog);
    } catch {
      // fall back to the chooser dialog so the user can pick a program
      setDialog({ kind: "openWith", path: ce.path });
    }
  }, [cursorEntry]);

  const saveAssoc = useCallback(
    async (assoc: ExtAssoc[]) => {
      const cfg = { ...configRef.current, assoc };
      configRef.current = cfg;
      setConfig(cfg);
      await saveConfig(cfg).catch(() => {});
    },
    [],
  );

  /** ---- native app menu (macOS: system menu bar) ---- */


  /** ---- keyboard ---- */

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement | null;
      if (tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA")) return;
      if (dialogRef.current) return; // dialogs handle their own keys

      const { left, right, active } = panelsRef.current;
      const panel = active === 0 ? left : right;

      // settings: macOS Cmd+, / others Ctrl+F12 (WinM: 환경 설정)
      if ((e.metaKey && e.key === ",") || (e.ctrlKey && e.key === "F12")) {
        e.preventDefault();
        openSettings();
        return;
      }
      // macOS: Cmd+A = select all (WinM reserves Ctrl+A for compress)
      if (e.metaKey && !e.ctrlKey && !e.altKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        panel.selectAll();
        return;
      }

      // ---- numpad combos (WinM 편집/보기 메뉴) ----
      if (
        e.code === "NumpadAdd" ||
        e.code === "NumpadSubtract" ||
        e.code === "NumpadMultiply" ||
        e.code === "NumpadDivide"
      ) {
        if (e.ctrlKey && e.altKey && e.code === "NumpadAdd") {
          e.preventDefault();
          setRowH((h) => Math.min(48, h + 4)); // Ctrl+Alt+Num+ 간격 넓힘
          return;
        }
        if (e.ctrlKey && e.altKey && e.code === "NumpadSubtract") {
          e.preventDefault();
          setRowH((h) => Math.max(18, h - 4)); // Ctrl+Alt+Num- 간격 좁힘
          return;
        }
        if (e.ctrlKey && !e.altKey && e.code === "NumpadAdd") {
          e.preventDefault();
          setDialog({ kind: "select", select: true }); // Ctrl+Num+ 이름으로 선택
          return;
        }
        if (e.ctrlKey && !e.altKey && e.code === "NumpadSubtract") {
          e.preventDefault();
          setDialog({ kind: "select", select: false }); // Ctrl+Num- 이름으로 해제
          return;
        }
        if (!e.ctrlKey && !e.altKey && e.code === "NumpadDivide") {
          e.preventDefault();
          selectSameExt(); // Num/ 같은 확장자 선택
          return;
        }
        if (e.ctrlKey && !e.altKey && e.code === "NumpadDivide") {
          e.preventDefault();
          selectSameName(); // Ctrl+Num/ 같은 이름 선택
          return;
        }
        if (e.ctrlKey && !e.altKey && e.code === "NumpadMultiply") {
          e.preventDefault();
          panel.invertSelection(); // Ctrl+Num* 선택 반전
          return;
        }
        return;
      }

      // ---- Ctrl+Alt combos (WinM 파일 메뉴) ----
      // macOS: Option(⌥) reports altKey; comboLetter maps ⌥+key like Alt+key
      if (e.ctrlKey && e.altKey && !e.metaKey && e.key.length === 1) {
        switch (comboLetter(e)) {
          case "s": // 파일 분할
          case "c": // 파일 결합
          case "m": // 파일 합치기
            e.preventDefault();
            openSplitCombine();
            return;
          default:
            break;
        }
      }

      // ---- Shift+Ctrl combos (WinM 보기 메뉴) ----
      if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.key.length === 1) {
        switch (e.key) {
          case "P":
          case "p":
            e.preventDefault();
            setShowPathbar((v) => !v); // 경로 표시줄
            return;
          case "H":
          case "h":
            e.preventDefault();
            setShowColHeader((v) => !v); // 헤더 컨트롤
            return;
          case "S":
          case "s":
            e.preventDefault();
            setShowStatusbar((v) => !v); // 상태 표시줄
            return;
          case "!":
            e.preventDefault();
            panel.setFilter(""); // 모든 파일
            return;
          case "@":
            e.preventDefault();
            panel.setFilter(PROG_FILTER); // 프로그램
            return;
          case "#":
            e.preventDefault();
            panel.setFilter(ZIP_FILTER); // 압축파일
            return;
          case ")":
            e.preventDefault();
            setDialog({ kind: "filter" }); // 사용자 지정
            return;
          default:
            break;
        }
      }

      // ---- Ctrl combos (WinM 파일/경로/압축 메뉴) ----
      if (e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (e.key === "Enter") {
          e.preventDefault(); // Ctrl+Enter 파라미터 입력 실행 (미구현)
          return;
        }
        if (e.key === "Backspace") {
          e.preventDefault();
          panel.goBack(); // Ctrl+BkSp 마지막 폴더로
          return;
        }
      }
      if (e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.key.length === 1) {
        switch (e.key.toLowerCase()) {
          case "1":
            e.preventDefault();
            applyLayout("single"); // Ctrl+1 단일 창
            return;
          case "2":
            e.preventDefault();
            applyLayout("vertical"); // Ctrl+2 수직 분할
            return;
          case "3":
            e.preventDefault();
            applyLayout("horizontal"); // Ctrl+3 수평 분할
            return;
          case "r":
            e.preventDefault();
            panel.refresh(); // Ctrl+R 새로 고침
            return;
          case "g":
            e.preventDefault();
            setDialog({ kind: "path" }); // Ctrl+G 경로 바꾸기
            return;
          case "a":
            e.preventDefault();
            openZip(); // Ctrl+A 압축하기
            return;
          case "m":
            e.preventDefault();
            openZip(); // Ctrl+M 압축후 삭제
            return;
          case "x": {
            // Ctrl+X 압축풀기
            e.preventDefault();
            const ce = cursorEntry();
            if (ce && !ce.isDir && ce.name.toLowerCase().endsWith(".zip")) openExtract(ce.path);
            return;
          }
          case "z":
            e.preventDefault();
            openProps(); // Ctrl+Z 속성/날짜 바꾸기
            return;
          default:
            return; // swallow other Ctrl+letter combos
        }
      }

      // ---- Alt+letter combos (WinM action accelerators) ----
      // macOS: Option(⌥) reports altKey; comboLetter maps ⌥+key like Alt+key
      // (⌥C yields "ç", so the physical key code is the fallback)
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.length === 1) {
        switch (comboLetter(e)) {
          case "c":
            e.preventDefault();
            openCopy("copy"); // 복사
            return;
          case "m":
            e.preventDefault();
            openCopy("move"); // 이동
            return;
          case "d":
            e.preventDefault();
            openDelete(); // 삭제
            return;
          case "r":
            e.preventDefault();
            openRename(); // 이름 바꾸기
            return;
          case "k":
            e.preventDefault();
            panel.setMkdirMode(true); // 폴더 만들기
            return;
          case "v":
            e.preventDefault();
            void openWithDefault(configRef.current.winm?.prog.viewer || undefined); // 파일 보기
            return;
          case "g":
            e.preventDefault();
            void openWithDefault(configRef.current.winm?.prog.editor || undefined); // 파일 편집
            return;
          case "x":
            e.preventDefault();
            quitApp(); // 종료
            return;
          case "z":
            e.preventDefault();
            panel.toggleHidden(); // 숨김 파일
            return;
          case "o":
          case "n":
            e.preventDefault();
            panel.setSort("name", "asc"); // 정렬안함 / 이름 정렬
            return;
          case "e":
            e.preventDefault();
            panel.setSort("ext", "asc"); // 확장자 정렬
            return;
          case "s":
            e.preventDefault();
            panel.setSort("size", "asc"); // 크기 정렬
            return;
          case "t":
            e.preventDefault();
            panel.setSort("mtime", "asc"); // 날짜 정렬
            return;
          case "-":
            e.preventDefault();
            panel.setSort(
              panel.state.sortKey,
              panel.state.sortDir === "asc" ? "desc" : "asc",
            ); // 오름차순 토글
            return;
          default:
            break;
        }
        // Alt+F/I/P/Y/B/L/H are menu mnemonics (handled by MenuBar)
        return;
      }

      // Alt+navigation
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          panel.goBack(); // 뒤로
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          panel.goForward(); // 앞으로
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          openProps(); // Alt+Enter 등록정보
          return;
        }
        return;
      }

      // Shift+Enter: 압축파일 보기 / Shift+F12: 드라이브 상자
      if (e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.key === "Enter") {
          e.preventDefault();
          openZipView();
          return;
        }
        if (e.key === "F12") {
          e.preventDefault();
          openDrive();
          return;
        }
      }

      switch (e.key) {
        case "Tab":
          e.preventDefault();
          setActive((a) => (a === 0 ? 1 : 0));
          return;
        case "ArrowUp":
          e.preventDefault();
          panel.moveCursor(-1);
          return;
        case "ArrowDown":
          e.preventDefault();
          panel.moveCursor(1);
          return;
        case "Home":
          e.preventDefault();
          panel.setCursor(0);
          return;
        case "End":
          e.preventDefault();
          panel.setCursor(Number.MAX_SAFE_INTEGER);
          return;
        case "PageUp":
          e.preventDefault();
          panel.pageMove(-1);
          return;
        case "PageDown":
          e.preventDefault();
          panel.pageMove(1);
          return;
        case "Enter":
          e.preventDefault();
          {
            const ce = cursorEntry();
            if (ce && !ce.isDir && ce.name.toLowerCase().endsWith(".zip")) {
              openZipView();
            } else {
              panel.enterAtCursor();
            }
          }
          return;
        case "Backspace":
          e.preventDefault();
          if (configRef.current.winm?.proc.backspaceUp !== false) panel.goParent();
          return;
        case " ":
          e.preventDefault();
          panel.toggleSelect();
          return;
        case "Insert":
          e.preventDefault();
          panel.toggleSelectDown();
          return;
        case "Delete":
          e.preventDefault();
          openDelete();
          return;
        case "Escape":
          panel.clearSelection();
          return;
        case "F1":
          e.preventDefault();
          setDialog({ kind: "help" });
          return;
        case "F2":
          e.preventDefault();
          panel.refresh();
          return;
        case "F3":
          e.preventDefault();
          openDrive();
          return;
        case "F4":
          e.preventDefault();
          openCopy("move");
          return;
        case "F5":
          e.preventDefault();
          openCopy("copy");
          return;
        case "F6":
          e.preventDefault();
          openRename();
          return;
        case "F7":
          e.preventDefault();
          panel.setMkdirMode(true);
          return;
        case "F8":
          e.preventDefault();
          openDelete();
          return;
        case "F9":
          e.preventDefault();
          openProps();
          return;
        case "F10":
          e.preventDefault();
          openMcd();
          return;
        case "F11":
          e.preventDefault();
          openQcd();
          return;
        case "F12":
          e.preventDefault();
          openSettings();
          return;
        default:
          break;
      }

      // type-ahead search: any printable char without modifiers jumps to the
      // first entry starting with the typed text. WinM binds every action to
      // an Alt/Ctrl combo, so all letters are free for search.
      if (
        configRef.current.winm?.proc.quickFindExt !== false &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        panel.typeAhead(e.key);
      }
    },
    [
      openCopy,
      openDelete,
      openRename,
      openZip,
      openZipView,
      openExtract,
      openSettings,
      openMcd,
      openQcd,
      openDrive,
      openSplitCombine,
      openProps,
      openWithDefault,
      cursorEntry,
      selectSameExt,
      selectSameName,
      quitApp,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const d = dialog;

  const activePanel = active === 0 ? left : right;

  // ---- WinM menu (docs/reference/winm-menus.png) ----
  // Rendered as an in-window menu bar; actions close over fresh render state.
  const winmActions: WinMActions = {
    copy: () => openCopy("copy"),
    move: () => openCopy("move"),
    del: () => openDelete(),
    rename: () => openRename(),
    mkdir: () => activePanel.setMkdirMode(true),
    props: () => openProps(),
    split: () => openSplitCombine(),
    viewFile: () => void openWithDefault(configRef.current.winm?.prog.viewer || undefined),
    editFile: () => void openWithDefault(configRef.current.winm?.prog.editor || undefined),
    fileList: () => setDialog({ kind: "fileList" }),
    quit: () => quitApp(),
    selPattern: (select: boolean) => setDialog({ kind: "select", select }),
    sameExt: () => selectSameExt(),
    sameName: () => selectSameName(),
    invertSel: () => activePanel.invertSelection(),
    selectAll: () => activePanel.selectAll(),
    clearSel: () => activePanel.clearSelection(),
    mcd: () => openMcd(),
    qcd: () => openQcd(),
    drive: () => openDrive(),
    back: () => activePanel.goBack(),
    forward: () => activePanel.goForward(),
    changePath: () => setDialog({ kind: "path" }),
    up: () => activePanel.goParent(),
    root: () => goRoot(),
    zip: () => openZip(),
    unzip: () => {
      const ce = cursorEntry();
      if (ce && !ce.isDir && ce.name.toLowerCase().endsWith(".zip")) openExtract(ce.path);
    },
    zipview: () => openZipView(),
    toggleToolbar: () => setShowToolbar((v) => !v),
    togglePathbar: () => setShowPathbar((v) => !v),
    toggleHeader: () => setShowColHeader((v) => !v),
    toggleStatusbar: () => setShowStatusbar((v) => !v),
    toggleHidden: () => activePanel.toggleHidden(),
    setLayout: (m) => applyLayout(m),
    setSort: (key, dir) => activePanel.setSort(key, dir),
    toggleSortDir: () =>
      activePanel.setSort(
        activePanel.state.sortKey,
        activePanel.state.sortDir === "asc" ? "desc" : "asc",
      ),
    setFilterPreset: (p) => activePanel.setFilter(p),
    filterDialog: () => setDialog({ kind: "filter" }),
    widerRows: () => setRowH((h) => Math.min(48, h + 4)),
    narrowerRows: () => setRowH((h) => Math.max(18, h - 4)),
    refresh: () => activePanel.refresh(),
    extConfig: () => openSettings(),
    setLangUi: (l) => setLangUi(l),
    setThemeUi: (t) => {
      const cfg = { ...configRef.current, theme: t };
      applyConfig(cfg);
      persistConfig(cfg);
    },
    settings: () => openSettings(),
    help: () => setDialog({ kind: "help" }),
  };

  const uiLang = getLang();
  const menus = useMemo(
    () =>
      buildWinMMenu({
        toolbar: showToolbar,
        pathbar: showPathbar,
        header: showColHeader,
        statusbar: showStatusbar,
        hidden: activePanel.state.showHidden,
        layout,
        sortKey: activePanel.state.sortKey,
        sortAsc: activePanel.state.sortDir === "asc",
        filter: activePanel.state.filter,
        lang: uiLang === "en" ? "en" : "ko",
        theme: config.theme === "light" ? "light" : "dark",
      }),
    [
      showToolbar,
      showPathbar,
      showColHeader,
      showStatusbar,
      activePanel,
      uiLang,
      config.theme,
      layout,
    ],
  );

  const fireMenuItem = (item: WinMItem) => {
    if (!item.act) return;
    (winmActions[item.act] as (...a: unknown[]) => void)(...(item.args ?? []));
  };

  // Keybar items: evenly distributed, mouse click invokes the same action as the shortcut.
  // Mirrors the WinM reference keybar: F2..F9.
  const keybarItems: { key: string; run: () => void }[] = [
    { key: "keybar.refresh", run: () => activePanel.refresh() },
    { key: "keybar.drive", run: () => openDrive() },
    { key: "keybar.move", run: () => openCopy("move") },
    { key: "keybar.copy", run: () => openCopy("copy") },
    { key: "keybar.rename", run: () => openRename() },
    { key: "keybar.mkdir", run: () => activePanel.setMkdirMode(true) },
    { key: "keybar.delete", run: () => openDelete() },
    { key: "keybar.props", run: () => openProps() },
  ];

  const kbItem = (it: { key: string; run: () => void }) => {
    const s = t(it.key);
    const i = s.indexOf(" ");
    return (
      <button
        key={it.key}
        className="kb-item"
        title={s}
        tabIndex={-1}
        onClick={(e) => {
          it.run();
          e.currentTarget.blur();
        }}
      >
        {i > 0 ? (
          <>
            <b>{s.slice(0, i)}</b>
            {s.slice(i)}
          </>
        ) : (
          s
        )}
      </button>
    );
  };

  // Toolbar actions (same handlers as keyboard shortcuts).
  const tools: ToolDef[] = [
    { id: "refresh", icon: <RefreshIcon />, title: t("keybar.refresh"), onClick: () => activePanel.refresh() },
    { id: "mkdir", icon: <MkdirIcon />, title: t("keybar.mkdir"), onClick: () => activePanel.setMkdirMode(true) },
    { id: "copy", icon: <CopyIcon />, title: t("keybar.copy"), onClick: () => openCopy("copy") },
    { id: "move", icon: <MoveIcon />, title: t("keybar.move"), onClick: () => openCopy("move") },
    { id: "delete", icon: <DeleteIcon />, title: t("keybar.delete"), onClick: () => openDelete() },
    { id: "rename", icon: <RenameIcon />, title: t("keybar.rename"), onClick: () => openRename() },
    {
      id: "zip",
      icon: <ArchiveIcon />,
      title: t("keybar.archive"),
      onClick: () => {
        const ce = cursorEntry();
        if (ce && !ce.isDir && ce.name.toLowerCase().endsWith(".zip")) openExtract(ce.path);
        else openZip();
      },
    },
    { id: "mcd", icon: <TreeIcon />, title: t("keybar.mcd"), onClick: () => openMcd() },
    { id: "qcd", icon: <BookmarkIcon />, title: t("keybar.qcd"), onClick: () => openQcd() },
    { id: "settings", icon: <SettingsIcon />, title: t("keybar.settings"), onClick: () => openSettings() },
    { id: "help", icon: <HelpIcon />, title: t("keybar.help"), onClick: () => setDialog({ kind: "help" }) },
  ];

  // ---- panel rendering (보기 > 창: 단일/수직분할/수평분할) ----
  const renderPanel = (side: 0 | 1) => {
    const isLeft = side === 0;
    const w = config.winm;
    const wp = isLeft ? w?.panel1 : w?.panel2;
    return (
      <Panel
        key={side}
        api={isLeft ? left : right}
        active={active === side}
        onActivate={() => setActive(side)}
        label={t(isLeft ? "panel.left" : "panel.right")}
        extColors={config.customExtColors}
        extColorOn={w?.color.extEnabled !== false}
        showColHeader={showColHeader && (isLeft ? colHeaderL : colHeaderR)}
        showPathBar={showPathbar && (isLeft ? pathbarL : pathbarR)}
        onOpenPath={() => {
          setActive(side);
          setDialog({ kind: "path" });
        }}
        colSep={wp?.columnSeparators !== false}
        rowSep={wp?.rowSeparators !== false}
        folderColor={w?.disp.folderInFolderColor !== false}
        rowH={rowH}
      />
    );
  };

  const visibleSides: (0 | 1)[] = layout === "single" ? [active] : [0, 1];

  return (
    <div className="app">
      <header className="app-header">
        <MenuBar menus={menus} onAction={fireMenuItem} />
        {showToolbar && <Toolbar tools={tools} />}
      </header>
      <main className={`panes layout-${layout}`}>
        {ready && visibleSides.map(renderPanel)}
      </main>
      <footer className="app-footer">
        {showStatusbar && (active === 0 ? statusbarL : statusbarR) && (
          <StatusBar
            panel={activePanel}
            showDrive={config.winm?.disp.driveCapacity === true && config.winm?.disp.driveCapacityTarget === "상태줄"}
            kbMb={config.winm?.disp.statusKbMb === true}
          />
        )}
        <div className="keybar">{keybarItems.map(kbItem)}</div>
      </footer>

      {d?.kind === "copy" && (
        <CopyDialog
          mode={d.mode}
          sources={d.sources}
          initialDest={d.dest}
          onClose={() => setDialog(null)}
          onStart={startCopyMove}
        />
      )}
      {d?.kind === "delete" && (
        <DeleteDialog
          paths={d.paths}
          defaultPermanent={configRef.current.winm?.proc.deleteDefaultYes || !configRef.current.useTrash}
          onClose={() => setDialog(null)}
          onStart={startDelete}
        />
      )}
      {d?.kind === "rename" && (
        <RenameDialog
          name={d.name}
          onClose={() => setDialog(null)}
          onSubmit={submitRename}
          onAdvanced={openBatchRename}
        />
      )}
      {d?.kind === "zip" && (
        <ZipDialog
          sources={d.sources}
          initialDest={d.dest}
          extPacker={
            config.winm?.arc.programs?.[0] && !config.winm.arc.programs[0].direct
              ? config.winm.arc.programs[0].path || config.extPacker || undefined
              : config.extPacker || undefined
          }
          onClose={() => setDialog(null)}
          onStart={startZip}
          onExtPack={() => setDialog({ kind: "extPack", mode: "pack", sources: d.sources })}
        />
      )}
      {d?.kind === "extPack" && (
        <ExtPackDialog
          mode={d.mode}
          sources={d.sources}
          command={d.mode === "pack" ? config.extPacker : config.extUnpacker}
          cwd={(active === 0 ? left : right).state.path}
          onClose={() => setDialog(null)}
          onDone={() => refreshBoth()}
        />
      )}
      {d?.kind === "zipview" && (
        <ZipViewDialog
          zipPath={d.zipPath}
          onClose={() => setDialog(null)}
          onExtract={() => openExtract(d.zipPath)}
        />
      )}
      {d?.kind === "extract" && (
        <ExtractDialog
          zipPath={d.zipPath}
          initialDest={d.dest}
          onClose={() => setDialog(null)}
          onStart={startExtract}
        />
      )}
      {d?.kind === "mcd" && <McdDialog onClose={() => setDialog(null)} onSelect={selectMcd} />}
      {d?.kind === "drive" && (
        <DriveDialog onClose={() => setDialog(null)} onSelect={selectDrive} />
      )}
      {d?.kind === "path" && (
        <PathDialog
          initial={activePanel.state.path}
          onGo={(p) => {
            setDialog(null);
            activePanel.load(p);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {d?.kind === "qcd" && (
        <QcdDialog
          entries={configRef.current.qcd}
          currentPath={(active === 0 ? left : right).state.path}
          onClose={() => setDialog(null)}
          onJump={jumpQcd}
          onSave={saveQcd}
        />
      )}
      {d?.kind === "split" && (
        <SplitDialog
          path={d.path}
          initialDest={d.dest}
          onClose={() => setDialog(null)}
          onStart={startSplit}
        />
      )}
      {d?.kind === "combine" && (
        <CombineDialog
          firstPart={d.firstPart}
          initialDest={d.dest}
          onClose={() => setDialog(null)}
          onStart={startCombine}
        />
      )}
      {d?.kind === "batchRename" && (
        <BatchRenameDialog
          files={d.files}
          onClose={() => setDialog(null)}
          onDone={() => {
            refreshBoth();
          }}
        />
      )}
      {d?.kind === "props" && (
        <PropsDialog
          path={d.path}
          dir={d.dir}
          name={d.name}
          onClose={() => setDialog(null)}
          onDone={() => {
            refreshBoth();
          }}
        />
      )}
      {d?.kind === "filter" && (
        <FilterDialog
          initial={(active === 0 ? left : right).state.filter}
          onClose={() => setDialog(null)}
          onApply={(f) => (active === 0 ? left : right).setFilter(f)}
        />
      )}
      {d?.kind === "select" && (
        <SelectDialog
          select={d.select}
          onClose={() => setDialog(null)}
          onApply={(pattern, select) => (active === 0 ? left : right).selectByPattern(pattern, select)}
        />
      )}
      {d?.kind === "help" && <HelpDialog onClose={() => setDialog(null)} />}
      {d?.kind === "fileList" && (
        <FileListDialog
          dir={(active === 0 ? left : right).state.path}
          entries={(active === 0 ? left : right).state.entries}
          onClose={() => setDialog(null)}
        />
      )}
      {d?.kind === "openWith" && (
        <OpenWithDialog
          path={d.path}
          config={config}
          onClose={() => setDialog(null)}
          onSaveAssoc={saveAssoc}
        />
      )}
      {d?.kind === "settings" && (
        <SettingsDialog
          config={configRef.current}
          onClose={() => setDialog(null)}
          onSave={saveSettings}
        />
      )}
      {d?.kind === "progress" && (
        <ProgressDialog
          opId={d.opId}
          title={d.title}
          showSpeed={configRef.current.winm?.proc.showCopySpeed !== false}
          onClose={() => setDialog(null)}
        />
      )}
      {d?.kind === "result" && (
        <ResultDialog title={d.title} summary={d.summary} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

export default App;
