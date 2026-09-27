import { invoke } from "@tauri-apps/api/core";

export interface QcdEntry {
  name: string;
  path: string;
  hotkey?: string;
}

export interface ExtAssoc {
  /** e.g. ".txt" (with dot, lowercase) */
  ext: string;
  /** program path; empty = system default */
  program: string;
}

export interface AppConfig {
  theme: "dark" | "light" | "custom";
  customThemeCss?: Record<string, string>;
  customExtColors?: Record<string, string>;
  customThemeName?: string;
  lang: "ko" | "en" | "custom";
  customLang?: Record<string, string>;
  customLangName?: string;
  showHidden: boolean;
  useTrash: boolean;
  confirmDelete: boolean;
  qcd: QcdEntry[];
  leftPath?: string;
  rightPath?: string;
  /** file extension → program associations */
  assoc: ExtAssoc[];
  /** external archiver commands, e.g. rar/7z */
  extPacker: string;
  extUnpacker: string;
  /** WinM-style settings (환경설정 dialog, 7 tabs) */
  winm?: WinmSettings;
}

export const defaultConfig: AppConfig = {
  theme: "dark",
  lang: "ko",
  showHidden: false,
  useTrash: true,
  confirmDelete: true,
  qcd: [],
  assoc: [],
  extPacker: "",
  extUnpacker: "",
};

export async function loadConfig(): Promise<AppConfig> {
  try {
    const cfg = await invoke<AppConfig>("config_load");
    const winm = cfg.winm
      ? {
          ...defaultWinmSettings,
          ...cfg.winm,
          panel1: { ...defaultWinmSettings.panel1, ...cfg.winm.panel1 },
          panel2: { ...defaultWinmSettings.panel2, ...cfg.winm.panel2 },
          disp: { ...defaultWinmSettings.disp, ...cfg.winm.disp },
          proc: { ...defaultWinmSettings.proc, ...cfg.winm.proc },
          color: {
            ...defaultWinmSettings.color,
            ...cfg.winm.color,
            items: { ...defaultWinmSettings.color.items, ...cfg.winm.color?.items },
          },
          arc: { ...defaultWinmSettings.arc, ...cfg.winm.arc },
          prog: { ...defaultWinmSettings.prog, ...cfg.winm.prog },
          etc: { ...defaultWinmSettings.etc, ...cfg.winm.etc },
        }
      : defaultWinmSettings;
    return { ...defaultConfig, ...cfg, winm };
  } catch {
    return { ...defaultConfig, winm: defaultWinmSettings };
  }
}

export async function saveConfig(cfg: AppConfig): Promise<void> {
  await invoke("config_save", { config: cfg });
}

/* ---------------- WinM-style settings (환경설정 dialog, 7 tabs) ---------------- */

/** per file-window settings (첫째/둘째 파일창 tab). */
export interface WinmPanelSettings {
  showPathBar: boolean;
  showHeader: boolean;
  showStatusBar: boolean;
  columnMode: string;
  columnUsage: string;
  sortBy: string;
  sortAsc: boolean;
  columnSeparators: boolean;
  showHidden: boolean;
  rowSeparators: boolean;
  propViewMode1: boolean;
}

export interface WinmSettings {
  panel1: WinmPanelSettings;
  panel2: WinmPanelSettings;
  pageScroll: boolean;
  autoColMode2Limit: boolean;
  autoColWidth: boolean;
  folderSortMethod: boolean;
  folderSortBy: string;
  defaultsPreset: string;
  disp: {
    analyzeIcons: boolean; showIcons: boolean; extractIcons: boolean;
    noExtractRemote: boolean; showTypeNoDesc: boolean;
    showMcdIcon: boolean; showTreeIcon: boolean;
    showSelMark: boolean; emphasizeSelColor: boolean; selBarOutline: boolean;
    folderTag: boolean; folderInFolderColor: boolean;
    ellipsisNoSpace: boolean; vertScrollbarOnly: boolean;
    folderCase: string; fileCase: string;
    driveDisplay: boolean; driveDisplayTarget: string;
    driveCapacity: boolean; driveCapacityTarget: string;
    tooltip: boolean; tooltipTime: number;
    hour24: boolean; year4: boolean;
    sizeUnit: string; statusKbMb: boolean; extAttached: boolean;
    alwaysShowHiddenDir: boolean; menuWrap: boolean; toolbarWrap: boolean;
    flatKeybar: boolean; treeColorAdjust: boolean; treeAutoFold: boolean;
    filewinFont: { name: string; size: number };
    mcdFont: { name: string; size: number };
  };
  proc: {
    keepSplitRatio: boolean; showSizeOnSelectDir: boolean; clearSizeOnDeselectDir: boolean;
    watchDirChanges: boolean; autoRefreshTree: boolean; treeFileAtRoot: boolean;
    quickFindExt: boolean; backspaceUp: boolean; ctrlPgUpDnMdir3: boolean;
    shiftDriveIME: boolean; driveSelectToMcd: boolean; splitTargetPath: string;
    noTrash: boolean; deleteDefaultYes: boolean; descAsHidden: boolean;
    read83Desc: boolean; write83Desc: boolean;
    dragDelay03: boolean; leftDropMenu: boolean;
    cdRemoveRO: boolean; askDeleteErrCopy: boolean; showCopySpeed: boolean;
    escFunc: string; tabFunc: string; midBtn: string; rightBtn: string;
  };
  color: {
    enabled: boolean;
    /** css var name (e.g. "--bg") -> hex color */
    items: Record<string, string>;
    extEnabled: boolean;
  };
  arc: {
    folderLike: boolean; noSfx: boolean; escExit: boolean;
    ctrlXExtract: boolean; extractToNamedDir: boolean;
    chdirAfterExtract: boolean; noExtractDlg: boolean;
    programs: { label: string; path: string; direct: boolean; showDirect: boolean }[];
  };
  prog: {
    quotePaths: boolean;
    viewer: string; viewerInMenu: boolean;
    editor: string; editorInMenu: boolean;
  };
  etc: {
    autoSave: boolean;
    keepSplit: boolean; syncHeaderGap: boolean; syncTreeSize: boolean; syncMcdPos: boolean;
    startMode: "last" | "path"; startPath: string;
    noNetStart: boolean; clearPrevOnExit: boolean;
  };
}

const winmPanelDefaults = (columnMode: string): WinmPanelSettings => ({
  showPathBar: true,
  showHeader: true,
  showStatusBar: true,
  columnMode,
  columnUsage: "모두 사용",
  sortBy: "확장자",
  sortAsc: true,
  columnSeparators: true,
  showHidden: false,
  rowSeparators: true,
  propViewMode1: false,
});

export const defaultWinmSettings: WinmSettings = {
  panel1: winmPanelDefaults("모드1"),
  panel2: winmPanelDefaults("자동선택"),
  pageScroll: false,
  autoColMode2Limit: false,
  autoColWidth: true,
  folderSortMethod: true,
  folderSortBy: "이름",
  defaultsPreset: "기본값",
  disp: {
    analyzeIcons: false, showIcons: false, extractIcons: false,
    noExtractRemote: false, showTypeNoDesc: false,
    showMcdIcon: true, showTreeIcon: false,
    showSelMark: true, emphasizeSelColor: true, selBarOutline: false,
    folderTag: true, folderInFolderColor: true,
    ellipsisNoSpace: true, vertScrollbarOnly: true,
    folderCase: "변경 안함", fileCase: "변경 안함",
    driveDisplay: true, driveDisplayTarget: "모든 파일창",
    driveCapacity: true, driveCapacityTarget: "드라이브 항목",
    tooltip: true, tooltipTime: 500,
    hour24: true, year4: true,
    sizeUnit: "바이트단위", statusKbMb: false, extAttached: false,
    alwaysShowHiddenDir: false, menuWrap: false, toolbarWrap: false,
    flatKeybar: true, treeColorAdjust: true, treeAutoFold: false,
    filewinFont: { name: "맑은 고딕", size: 12 },
    mcdFont: { name: "맑은 고딕", size: 12 },
  },
  proc: {
    keepSplitRatio: true, showSizeOnSelectDir: false, clearSizeOnDeselectDir: false,
    watchDirChanges: true, autoRefreshTree: false, treeFileAtRoot: false,
    quickFindExt: true, backspaceUp: true, ctrlPgUpDnMdir3: false,
    shiftDriveIME: true, driveSelectToMcd: true, splitTargetPath: "다른창으로 작업할지 묻기",
    noTrash: false, deleteDefaultYes: false, descAsHidden: true,
    read83Desc: true, write83Desc: false,
    dragDelay03: false, leftDropMenu: false,
    cdRemoveRO: true, askDeleteErrCopy: false, showCopySpeed: true,
    escFunc: "최소화", tabFunc: "다른 창으로", midBtn: "지정 안함", rightBtn: "탐색기 메뉴",
  },
  color: {
    enabled: true,
    items: {
      "--bg": "#000000",
      "--fg": "#d8d8d8",
      "--dir-fg": "#ff0000",
      "--accent": "#0e639c",
      "--cursor-bg": "#ff0000",
      "--border": "#333333",
      "--rowsep": "#222222",
      "--info": "#8cdcfe",
      "--hidden-fg": "#777777",
      "--ro-fg": "#999999",
      "--bigsize-fg": "#ffff00",
      "--mcd-bg": "#141414",
      "--mcd-fg": "#d8d8d8",
    },
    extEnabled: true,
  },
  arc: {
    folderLike: true, noSfx: true, escExit: true,
    ctrlXExtract: true, extractToNamedDir: true,
    chdirAfterExtract: false, noExtractDlg: false,
    programs: [
      { label: "ZIP 압축", path: "pkzip.exe", direct: true, showDirect: true },
      { label: "ZIP 해제", path: "pkunzip.exe", direct: false, showDirect: false },
      { label: "RAR 파일", path: "C:\\WinRaR\\WinRAR.exe", direct: true, showDirect: true },
      { label: "ACE 파일", path: "C:\\Program Files\\WinAce\\winace.exe", direct: true, showDirect: true },
      { label: "ARJ 파일", path: "ARJ32.EXE", direct: true, showDirect: true },
      { label: "LZH 파일", path: "lha.exe", direct: true, showDirect: true },
    ],
  },
  prog: {
    quotePaths: true,
    viewer: "C:\\Program Files\\WEasyView\\WEasyView.exe", viewerInMenu: true,
    editor: "C:\\Program Files\\WEasyPad\\WEasyPad.exe", editorInMenu: true,
  },
  etc: {
    autoSave: true,
    keepSplit: true, syncHeaderGap: true, syncTreeSize: true, syncMcdPos: true,
    startMode: "last", startPath: "C:\\",
    noNetStart: true, clearPrevOnExit: false,
  },
};
