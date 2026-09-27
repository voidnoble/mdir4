import { useCallback, useEffect, useRef, useState } from "react";
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
import PathBar from "./components/PathBar";
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
import { buildAppMenu, type AppMenuActions } from "./lib/appMenu";
import type { AppConfig, ExtAssoc, QcdEntry } from "./lib/config";
import { defaultConfig, loadConfig, saveConfig } from "./lib/config";
import type { OpSummary, OverwritePolicy } from "./lib/fs";
import {
  fsCombine,
  fsCopy,
  fsDelete,
  fsHome,
  fsMove,
  fsRename,
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

function App() {
  const t = useT();
  const left = usePanel("/");
  const right = usePanel("/");
  const [active, setActive] = useState<0 | 1>(0);
  const [ready, setReady] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
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
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cfg = await loadConfig();
      if (cancelled) return;
      applyConfig(cfg);
      panelsRef.current.left.setShowHidden(cfg.showHidden);
      panelsRef.current.right.setShowHidden(cfg.showHidden);
      const home = await fsHome().catch(() => "/");
      if (cancelled) return;
      panelsRef.current.left.load(cfg.leftPath ?? home);
      panelsRef.current.right.load(cfg.rightPath ?? home);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist panel paths (debounced)
  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => {
      const cfg = { ...configRef.current, leftPath: left.state.path, rightPath: right.state.path };
      configRef.current = cfg;
      saveConfig(cfg).catch(() => {});
    }, 800);
    return () => window.clearTimeout(id);
  }, [ready, left.state.path, right.state.path]);

  const persistConfig = useCallback((cfg: AppConfig) => {
    const merged = { ...configRef.current, ...cfg, leftPath: panelsRef.current.left.state.path, rightPath: panelsRef.current.right.state.path };
    configRef.current = merged;
    saveConfig(merged).catch(() => {});
  }, []);

  const saveSettings = useCallback(
    (cfg: AppConfig) => {
      applyConfig(cfg);
      persistConfig(cfg);
      // re-apply hidden filter if the setting changed
      panelsRef.current.left.setShowHidden(cfg.showHidden);
      panelsRef.current.right.setShowHidden(cfg.showHidden);
      setDialog(null);
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

  const openWithDefault = useCallback(async () => {
    const ce = cursorEntry();
    if (!ce || ce.isDir) return;
    const cfg = configRef.current;
    const prog = cfg.assoc.find((a) => a.ext === extOf(ce.name))?.program || undefined;
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

  // Always-fresh action table; the native menu dispatches through this ref
  // so menu item handlers never capture stale closures.
  const menuActionsRef = useRef<AppMenuActions | null>(null);
  menuActionsRef.current = {
    copy: () => openCopy("copy"),
    move: () => openCopy("move"),
    del: () => openDelete(),
    rename: () => openRename(),
    mkdir: () => {
      const { left, right, active } = panelsRef.current;
      (active === 0 ? left : right).setMkdirMode(true);
    },
    openWith: () => void openWithDefault(),
    props: () => openProps(),
    selectAll: () => {
      const { left, right, active } = panelsRef.current;
      (active === 0 ? left : right).selectAll();
    },
    invertSel: () => {
      const { left, right, active } = panelsRef.current;
      (active === 0 ? left : right).invertSelection();
    },
    selPattern: (select: boolean) => setDialog({ kind: "select", select }),
    mcd: () => openMcd(),
    qcd: () => openQcd(),
    back: () => {
      const { left, right, active } = panelsRef.current;
      (active === 0 ? left : right).goBack();
    },
    forward: () => {
      const { left, right, active } = panelsRef.current;
      (active === 0 ? left : right).goForward();
    },
    refresh: () => {
      const { left, right, active } = panelsRef.current;
      (active === 0 ? left : right).refresh();
    },
    zip: () => openZip(),
    unzip: () => {
      const ce = cursorEntry();
      if (ce && !ce.isDir && ce.name.toLowerCase().endsWith(".zip")) openExtract(ce.path);
    },
    zipview: () => openZipView(),
    split: () => openSplitCombine(),
    filter: () => setDialog({ kind: "filter" }),
    toggleHidden: () => {
      const { left, right, active } = panelsRef.current;
      (active === 0 ? left : right).toggleHidden();
    },
    fileList: () => setDialog({ kind: "fileList" }),
    batchRename: () => openBatchRename(),
    settings: () => openSettings(),
    help: () => setDialog({ kind: "help" }),
  };

  // (Re)build the native menu on mount and whenever the UI language changes.
  const uiLang = getLang();
  useEffect(() => {
    const via = (fn: (m: AppMenuActions) => void) => () => {
      const m = menuActionsRef.current;
      if (m) fn(m);
    };
    void buildAppMenu({
      copy: via((m) => m.copy()),
      move: via((m) => m.move()),
      del: via((m) => m.del()),
      rename: via((m) => m.rename()),
      mkdir: via((m) => m.mkdir()),
      openWith: via((m) => m.openWith()),
      props: via((m) => m.props()),
      selectAll: via((m) => m.selectAll()),
      invertSel: via((m) => m.invertSel()),
      selPattern: (select: boolean) => via((m) => m.selPattern(select))(),
      mcd: via((m) => m.mcd()),
      qcd: via((m) => m.qcd()),
      back: via((m) => m.back()),
      forward: via((m) => m.forward()),
      refresh: via((m) => m.refresh()),
      zip: via((m) => m.zip()),
      unzip: via((m) => m.unzip()),
      zipview: via((m) => m.zipview()),
      split: via((m) => m.split()),
      filter: via((m) => m.filter()),
      toggleHidden: via((m) => m.toggleHidden()),
      fileList: via((m) => m.fileList()),
      batchRename: via((m) => m.batchRename()),
      settings: via((m) => m.settings()),
      help: via((m) => m.help()),
    });
  }, [uiLang]);

  /** ---- keyboard ---- */

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement | null;
      if (tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA")) return;
      if (dialogRef.current) return; // dialogs handle their own keys

      const { left, right, active } = panelsRef.current;
      const panel = active === 0 ? left : right;

      // settings: macOS Cmd+, / others Ctrl+F12 (WinM: F12)
      if ((e.metaKey && e.key === ",") || (e.ctrlKey && e.key === "F12")) {
        e.preventDefault();
        openSettings();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        panel.selectAll();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        panel.refresh();
        return;
      }

      // Alt+letter shortcuts (WinM file-menu style)
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.length === 1) {
        switch (e.key.toLowerCase()) {
          case "m":
            e.preventDefault();
            openCopy("move");
            return;
          case "d":
            e.preventDefault();
            openDelete();
            return;
          case "r":
            e.preventDefault();
            openRename();
            return;
          case "k":
            e.preventDefault();
            panel.setMkdirMode(true);
            return;
        }
      }

      // Alt+navigation
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          panel.goBack();
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          panel.goForward();
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          openProps();
          return;
        }
      }

      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        panel.invertSelection();
        return;
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
          panel.goParent();
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

      // MDir single-letter hotkeys (no modifiers)
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Shift+N = deselect by pattern (keep before lowercase switch)
        if (e.key === "N") {
          setDialog({ kind: "select", select: false });
          return;
        }
        switch (e.key.toLowerCase()) {
          case "c":
            openCopy("copy");
            return;
          case "m":
            openCopy("move");
            return;
          case "d":
            openDelete();
            return;
          case "r":
            openRename();
            return;
          case "k":
            panel.setMkdirMode(true);
            return;
          case "z":
            panel.toggleHidden();
            return;
          case "u":
            panel.selectAll();
            return;
          case "s":
            openSplitCombine();
            return;
          case "f":
            setDialog({ kind: "filter" });
            return;
          case "v":
            panel.invertSelection();
            return;
          case "n":
            setDialog({ kind: "select", select: true });
            return;
          case "o":
            openWithDefault();
            return;
          case "l":
            setDialog({ kind: "fileList" });
            return;
          case "a": {
            const ce = cursorEntry();
            if (ce && !ce.isDir && ce.name.toLowerCase().endsWith(".zip")) openExtract(ce.path);
            else openZip();
            return;
          }
          default:
            // type-ahead search: jump to the first entry starting with the
            // typed text (single-letter hotkeys above take precedence)
            panel.typeAhead(e.key);
            return;
        }
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
      openBatchRename,
      openProps,
      openWithDefault,
      cursorEntry,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const d = dialog;

  const activePanel = active === 0 ? left : right;

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

  return (
    <div className="app">
      <header className="app-header">
        <Toolbar tools={tools} />
        <PathBar
          path={activePanel.state.path}
          filter={activePanel.state.filter}
          onOpen={() => setDialog({ kind: "path" })}
        />
      </header>
      <main className="panes">
        {ready && (
          <>
            <Panel
              api={left}
              active={active === 0}
              onActivate={() => setActive(0)}
              label={t("panel.left")}
              extColors={config.customExtColors}
            />
            <Panel
              api={right}
              active={active === 1}
              onActivate={() => setActive(1)}
              label={t("panel.right")}
              extColors={config.customExtColors}
            />
          </>
        )}
      </main>
      <footer className="app-footer">
        <StatusBar panel={activePanel} />
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
          defaultPermanent={!configRef.current.useTrash}
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
          extPacker={config.extPacker || undefined}
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
        <ProgressDialog opId={d.opId} title={d.title} onClose={() => setDialog(null)} />
      )}
      {d?.kind === "result" && (
        <ResultDialog title={d.title} summary={d.summary} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

export default App;
