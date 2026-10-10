import type { SortDir, SortKey } from "../hooks/usePanel";

/**
 * WinM menu model, transcribed from docs/reference/winm-menus.png.
 *
 * Top-level order: 파일(F) 편집(I) 경로(P) 압축(Y) 보기(B) 도구(L) 도움말(H).
 * Item names, mnemonics, shortcut hints and the left/right layout mirror the
 * reference. Items with no Mdir4 equivalent are included but disabled.
 */

export interface WinMItem {
  id: string;
  /** translation key for the label (without mnemonic) */
  label: string;
  /** mnemonic shown as (X); may be multi-char like "MCD" */
  mnemonic?: string;
  /** right-aligned shortcut hint, e.g. "Alt+C" */
  sc?: string;
  checked?: boolean;
  disabled?: boolean;
  sep?: boolean;
  sub?: WinMItem[];
  act?: keyof WinMActions;
  /** extra arguments passed to the action */
  args?: unknown[];
}

export interface WinMTop {
  id: string;
  label: string;
  mnemonic: string;
  items: WinMItem[];
}

/** Every action the WinM menu can trigger. Implemented by App. */
export interface WinMActions {
  copy(): void;
  move(): void;
  del(): void;
  rename(): void;
  mkdir(): void;
  props(): void;
  split(): void;
  viewFile(): void;
  editFile(): void;
  fileList(): void;
  quit(): void;
  selPattern(select: boolean): void;
  sameExt(): void;
  sameName(): void;
  invertSel(): void;
  selectAll(): void;
  clearSel(): void;
  mcd(): void;
  qcd(): void;
  drive(): void;
  back(): void;
  forward(): void;
  changePath(): void;
  up(): void;
  root(): void;
  zip(): void;
  unzip(): void;
  zipview(): void;
  toggleToolbar(): void;
  togglePathbar(): void;
  toggleHeader(): void;
  toggleStatusbar(): void;
  toggleHidden(): void;
  setLayout(m: "single" | "vertical" | "horizontal"): void;
  setSort(key: SortKey, dir: SortDir): void;
  toggleSortDir(): void;
  setFilterPreset(p: string): void;
  filterDialog(): void;
  widerRows(): void;
  narrowerRows(): void;
  refresh(): void;
  extConfig(): void;
  setLangUi(l: "ko" | "en"): void;
  setThemeUi(t: "dark" | "light"): void;
  settings(): void;
  help(): void;
  about(): void;
}

export interface WinMState {
  toolbar: boolean;
  pathbar: boolean;
  header: boolean;
  statusbar: boolean;
  hidden: boolean;
  layout: "single" | "vertical" | "horizontal";
  sortKey: SortKey;
  sortAsc: boolean;
  filter: string;
  lang: "ko" | "en";
  theme: "dark" | "light";
}

export const PROG_FILTER = "*.exe;*.com;*.bat";
export const ZIP_FILTER = "*.zip;*.7z;*.rar;*.tar;*.gz;*.bz2;*.xz";

const it = (
  id: string,
  label: string,
  o: Partial<WinMItem> = {},
): WinMItem => ({ id, label, ...o });
const sep = (id: string): WinMItem => ({ id, label: "", sep: true });

export function buildWinMMenu(st: WinMState): WinMTop[] {
  return [
    {
      id: "file",
      label: "wm.file",
      mnemonic: "F",
      items: [
        it("new", "wm.file.new", { mnemonic: "W", sc: "Ctrl+H", disabled: true }),
        sep("s1"),
        it("copy", "wm.file.copy", { mnemonic: "C", sc: "Alt+C", act: "copy" }),
        it("move", "wm.file.move", { mnemonic: "M", sc: "Alt+M", act: "move" }),
        it("del", "wm.file.del", { mnemonic: "D", sc: "Alt+D", act: "del" }),
        sep("s2"),
        it("rename", "wm.file.rename", { mnemonic: "R", sc: "Alt+R", act: "rename" }),
        it("mkdir", "wm.file.mkdir", { mnemonic: "K", sc: "Alt+K", act: "mkdir" }),
        sep("s3"),
        it("attrdate", "wm.file.attrdate", { mnemonic: "Z", sc: "Ctrl+Z", act: "props" }),
        it("comment", "wm.file.comment", { mnemonic: "S", sc: "Ctrl+Alt+Enter", disabled: true }),
        it("delcomment", "wm.file.delcomment", { mnemonic: "E", disabled: true }),
        it("shortcut", "wm.file.shortcut", { mnemonic: "S", sc: "Ctrl+S", disabled: true }),
        sep("s4"),
        it("split", "wm.file.split", { mnemonic: "T", sc: "Ctrl+Alt+S", act: "split" }),
        it("combine", "wm.file.combine", { mnemonic: "O", sc: "Ctrl+Alt+C", act: "split" }),
        it("merge", "wm.file.merge", { mnemonic: "G", sc: "Ctrl+Alt+M", act: "split" }),
        sep("s5"),
        it("view", "wm.file.view", { sc: "Alt+V", act: "viewFile" }),
        it("edit", "wm.file.edit", { sc: "Alt+G", act: "editFile" }),
        sep("s6"),
        it("paramexec", "wm.file.paramexec", { mnemonic: "P", sc: "Ctrl+Enter", disabled: true }),
        it("doscmd", "wm.file.doscmd", { mnemonic: "N", sc: "/", disabled: true }),
        sep("s7"),
        it("dirsize", "wm.file.dirsize", { sc: "Shift+Alt+Enter", disabled: true }),
        it("makelist", "wm.file.makelist", { mnemonic: "I", act: "fileList" }),
        it("makelistsel", "wm.file.makelistsel", { mnemonic: "L", act: "fileList" }),
        sep("s8"),
        it("props", "wm.file.props", { mnemonic: "P", sc: "Alt+Enter", act: "props" }),
        sep("s9"),
        it("quit", "wm.file.quit", { mnemonic: "X", sc: "Alt+X", act: "quit" }),
      ],
    },
    {
      id: "edit",
      label: "wm.edit",
      mnemonic: "I",
      items: [
        it("clipcopy", "wm.edit.clipcopy", { sc: "Ctrl+C", disabled: true }),
        it("clipcut", "wm.edit.clipcut", { sc: "Ctrl+Del", disabled: true }),
        it("clippaste", "wm.edit.clippaste", { sc: "Ctrl+V", disabled: true }),
        it("pastehere", "wm.edit.pastehere", { sc: "Shift+Ctrl+Ins", disabled: true }),
        sep("s1"),
        it("quickfind", "wm.edit.quickfind", { mnemonic: "S", sc: "Shift+Ctrl+L", disabled: true }),
        it("findnext", "wm.edit.findnext", { mnemonic: "X", sc: "Ctrl+L", disabled: true }),
        sep("s2"),
        it("selpattern", "wm.edit.selpattern", { mnemonic: "N", sc: "Ctrl+Num +", act: "selPattern", args: [true] }),
        it("deselpattern", "wm.edit.deselpattern", { mnemonic: "M", sc: "Ctrl+Num -", act: "selPattern", args: [false] }),
        sep("s3"),
        it("sameext", "wm.edit.sameext", { mnemonic: "E", sc: "Num /", act: "sameExt" }),
        it("samename", "wm.edit.samename", { mnemonic: "F", sc: "Ctrl+Num /", act: "sameName" }),
        it("invert", "wm.edit.invert", { mnemonic: "I", sc: "Ctrl+Num *", act: "invertSel" }),
        sep("s4"),
        it("selall", "wm.edit.selall", { mnemonic: "A", act: "selectAll" }),
        it("deselall", "wm.edit.deselall", { mnemonic: "U", act: "clearSel" }),
      ],
    },
    {
      id: "path",
      label: "wm.path",
      mnemonic: "P",
      items: [
        it("mcd", "wm.path.mcd", { mnemonic: "MCD", sc: "F10", act: "mcd" }),
        it("qcd", "wm.path.qcd", { mnemonic: "QCD", sc: "F11", act: "qcd" }),
        it("drive", "wm.path.drive", { mnemonic: "V", sc: "Shift+F12", act: "drive" }),
        sep("s1"),
        it("netconn", "wm.path.netconn", { mnemonic: "N", sc: "Ctrl+N", disabled: true }),
        it("netdisconn", "wm.path.netdisconn", { mnemonic: "U", sc: "Ctrl+U", disabled: true }),
        sep("s2"),
        it("back", "wm.path.back", { mnemonic: "B", sc: "Alt+Left", act: "back" }),
        it("forward", "wm.path.forward", { mnemonic: "F", sc: "Alt+Right", act: "forward" }),
        it("lastfolder", "wm.path.lastfolder", { mnemonic: "L", sc: "Ctrl+BkSp", act: "back" }),
        it("changepath", "wm.path.changepath", { mnemonic: "G", sc: "Ctrl+G", act: "changePath" }),
        sep("s3"),
        it("up", "wm.path.up", { mnemonic: "P", act: "up" }),
        it("root", "wm.path.root", { mnemonic: "T", act: "root" }),
        sep("s4"),
        it("mydocs", "wm.path.mydocs", { mnemonic: "Y", sc: "Shift+F11", disabled: true }),
        it("desktop", "wm.path.desktop", { mnemonic: "D", sc: "Shift+Ctrl+F11", disabled: true }),
        it("startmenu", "wm.path.startmenu", { mnemonic: "S", sc: "Shift+Ctrl+F12", disabled: true }),
        sep("s5"),
        it("temp", "wm.path.temp", { mnemonic: "T", disabled: true }),
        sep("s6"),
        it("controlpanel", "wm.path.controlpanel", { mnemonic: "C", disabled: true }),
        it("recycle", "wm.path.recycle", { mnemonic: "R", disabled: true }),
        it("emptyrecycle", "wm.path.emptyrecycle", { mnemonic: "E", disabled: true }),
      ],
    },
    {
      id: "archive",
      label: "wm.archive",
      mnemonic: "Y",
      items: [
        it("zipview", "wm.archive.zipview", { mnemonic: "A", sc: "Shift+Enter", act: "zipview" }),
        it("zip", "wm.archive.zip", { mnemonic: "A", sc: "Ctrl+A", act: "zip" }),
        it("zipdel", "wm.archive.zipdel", { mnemonic: "M", sc: "Ctrl+M", act: "zip" }),
        it("unzip", "wm.archive.unzip", { mnemonic: "E", sc: "Ctrl+X", act: "unzip" }),
      ],
    },
    {
      id: "view",
      label: "wm.view",
      mnemonic: "B",
      items: [
        it("window", "wm.view.window", {
          mnemonic: "W",
          sub: [
            it("single", "wm.view.single", {
              mnemonic: "S",
              sc: "Ctrl+1",
              checked: st.layout === "single",
              act: "setLayout",
              args: ["single"],
            }),
            it("vsplit", "wm.view.vsplit", {
              mnemonic: "V",
              sc: "Ctrl+2",
              checked: st.layout === "vertical",
              act: "setLayout",
              args: ["vertical"],
            }),
            it("hsplit", "wm.view.hsplit", {
              mnemonic: "H",
              sc: "Ctrl+3",
              checked: st.layout === "horizontal",
              act: "setLayout",
              args: ["horizontal"],
            }),
          ],
        }),
        // NOTE: the reference does not show this submenu's contents; it
        // toggles the app's icon toolbar.
        it("controls", "wm.view.controls", {
          mnemonic: "C",
          sub: [
            it("toolbar", "wm.view.toolbar", {
              mnemonic: "T",
              checked: st.toolbar,
              act: "toggleToolbar",
            }),
          ],
        }),
        sep("s1"),
        it("pathbar", "wm.view.pathbar", {
          mnemonic: "P",
          sc: "Shift+Ctrl+P",
          checked: st.pathbar,
          act: "togglePathbar",
        }),
        it("header", "wm.view.header", {
          mnemonic: "H",
          sc: "Shift+Ctrl+H",
          checked: st.header,
          act: "toggleHeader",
        }),
        it("drivebar", "wm.view.drivebar", { mnemonic: "D", sc: "Shift+Ctrl+D", disabled: true }),
        it("statusbar", "wm.view.statusbar", {
          mnemonic: "S",
          sc: "Shift+Ctrl+S",
          checked: st.statusbar,
          act: "toggleStatusbar",
        }),
        it("theme", "wm.view.theme", {
          mnemonic: "T",
          sub: [
            it("themedark", "wm.view.themeDark", { checked: st.theme === "dark", act: "setThemeUi", args: ["dark"] }),
            it("themelight", "wm.view.themeLight", { checked: st.theme === "light", act: "setThemeUi", args: ["light"] }),
          ],
        }),
        it("foldertree", "wm.view.foldertree", { mnemonic: "F", sc: "Shift+Ctrl+F", disabled: true }),
        sep("s2"),
        it("automode", "wm.view.automode", { mnemonic: "O", sc: "Alt+0", disabled: true }),
        it("mode1", "wm.view.mode1", { sc: "Alt+1", checked: true, disabled: true }),
        it("mode2", "wm.view.mode2", { sc: "Alt+2", disabled: true }),
        it("mode3", "wm.view.mode3", { sc: "Alt+3", disabled: true }),
        it("mode4", "wm.view.mode4", { sc: "Alt+4", disabled: true }),
        it("mode5", "wm.view.mode5", { sc: "Alt+5", disabled: true }),
        it("mode6", "wm.view.mode6", { sc: "Alt+6", disabled: true }),
        sep("s3"),
        it("hidden", "wm.view.hidden", {
          mnemonic: "Z",
          sc: "Alt+Z",
          checked: st.hidden,
          act: "toggleHidden",
        }),
        it("attrcol", "wm.view.attrcol", { mnemonic: "A", sc: "Alt+A", disabled: true }),
        sep("s4"),
        it("sort", "wm.view.sort", {
          mnemonic: "O",
          sub: [
            it("sortnone", "wm.view.sortnone", { mnemonic: "O", sc: "Alt+O", act: "setSort", args: ["name", "asc"] }),
            it("sortname", "wm.view.sortname", { mnemonic: "N", sc: "Alt+N", act: "setSort", args: ["name", "asc"] }),
            it("sortext", "wm.view.sortext", { mnemonic: "E", sc: "Alt+E", act: "setSort", args: ["ext", "asc"] }),
            it("sortsize", "wm.view.sortsize", { mnemonic: "S", sc: "Alt+S", act: "setSort", args: ["size", "asc"] }),
            it("sortdate", "wm.view.sortdate", { mnemonic: "T", sc: "Alt+T", act: "setSort", args: ["mtime", "asc"] }),
            it("sortcolor", "wm.view.sortcolor", { mnemonic: "C", disabled: true }),
            it("sortcomment", "wm.view.sortcomment", { mnemonic: "Y", disabled: true }),
            it("sortattr", "wm.view.sortattr", { mnemonic: "A", disabled: true }),
            it("sortexe", "wm.view.sortexe", { mnemonic: "Q", sc: "Alt+Q", disabled: true }),
            sep("ss1"),
            it("ascending", "wm.view.ascending", {
              mnemonic: "-",
              sc: "Alt+-",
              checked: st.sortAsc,
              act: "toggleSortDir",
            }),
          ],
        }),
        it("filter", "wm.view.filter", {
          mnemonic: "F",
          sub: [
            it("filterall", "wm.view.filterall", {
              mnemonic: "A",
              sc: "Shift+Ctrl+1",
              checked: st.filter === "",
              act: "setFilterPreset",
              args: [""],
            }),
            it("filterprog", "wm.view.filterprog", {
              mnemonic: "G",
              sc: "Shift+Ctrl+2",
              checked: st.filter === PROG_FILTER,
              act: "setFilterPreset",
              args: [PROG_FILTER],
            }),
            it("filterzip", "wm.view.filterzip", {
              mnemonic: "V",
              sc: "Shift+Ctrl+3",
              checked: st.filter === ZIP_FILTER,
              act: "setFilterPreset",
              args: [ZIP_FILTER],
            }),
            it("filterext", "wm.view.filterext", { mnemonic: "E", sc: "Shift+Ctrl+4", disabled: true }),
            it("filtercolor", "wm.view.filtercolor", { mnemonic: "C", sc: "Shift+Ctrl+5", disabled: true }),
            it("filtercustom", "wm.view.filtercustom", {
              mnemonic: "U",
              sc: "Shift+Ctrl+0",
              act: "filterDialog",
            }),
          ],
        }),
        it("linespacing", "wm.view.linespacing", {
          mnemonic: "M",
          sub: [
            it("wider", "wm.view.wider", { sc: "Ctrl+Alt+Num +", act: "widerRows" }),
            it("narrower", "wm.view.narrower", { sc: "Ctrl+Alt+Num -", act: "narrowerRows" }),
          ],
        }),
        sep("s5"),
        it("refresh", "wm.view.refresh", { mnemonic: "R", sc: "Ctrl+R", act: "refresh" }),
      ],
    },
    {
      id: "tools",
      label: "wm.tools",
      mnemonic: "L",
      items: [
        it("keyconfig", "wm.tools.keyconfig", { mnemonic: "F", disabled: true }),
        it("extconfig", "wm.tools.extconfig", { mnemonic: "E", act: "extConfig" }),
        sep("s1"),
        it("language", "wm.tools.language", {
          sub: [
            it("korean", "wm.tools.korean", { checked: st.lang === "ko", act: "setLangUi", args: ["ko"] }),
            it("english", "wm.tools.english", { checked: st.lang === "en", act: "setLangUi", args: ["en"] }),
          ],
        }),
        sep("s2"),
        it("saveenv", "wm.tools.saveenv", { mnemonic: "V", disabled: true }),
        it("settings", "wm.tools.settings", { mnemonic: "S", sc: "Ctrl+F12", act: "settings" }),
      ],
    },
    {
      id: "help",
      label: "wm.help",
      mnemonic: "H",
      items: [
        it("helpitem", "wm.help.helpitem", { mnemonic: "H", sc: "F1", act: "help" }),
        it("keylist", "wm.help.keylist", { mnemonic: "K", act: "help" }),
        sep("s1"),
        it("homepage", "wm.help.homepage", { mnemonic: "W", disabled: true }),
        it("email", "wm.help.email", { mnemonic: "E", disabled: true }),
        sep("s2"),
        it("update", "wm.help.update", { disabled: true }),
        sep("s3"),
        it("about", "wm.help.about", { mnemonic: "A", act: "about" }),
      ],
    },
  ];
}
