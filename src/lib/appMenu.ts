import { Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu";
import { t } from "../i18n";

/** Actions the native app menu can trigger. Wired to the App component. */
export interface AppMenuActions {
  copy(): void;
  move(): void;
  del(): void;
  rename(): void;
  mkdir(): void;
  openWith(): void;
  props(): void;
  selectAll(): void;
  invertSel(): void;
  selPattern(select: boolean): void;
  mcd(): void;
  qcd(): void;
  back(): void;
  forward(): void;
  refresh(): void;
  zip(): void;
  unzip(): void;
  zipview(): void;
  split(): void;
  filter(): void;
  toggleHidden(): void;
  fileList(): void;
  batchRename(): void;
  settings(): void;
  help(): void;
}

/**
 * Build the native application menu and install it via `setAsAppMenu()`.
 *
 * On macOS this places the menus in the screen-top system menu bar;
 * on Windows/Linux it becomes the window's native menu bar.
 * Clicking a menu opens its submenu natively (no HTML menu needed).
 *
 * No accelerators are registered on purpose: keyboard shortcuts keep
 * working through the existing frontend key handler, which correctly
 * ignores keystrokes while dialogs are open or text fields are focused.
 * Shortcut hints are shown in the item labels instead.
 *
 * Returns false when the Tauri menu API is unavailable (plain browser).
 */
export async function buildAppMenu(act: AppMenuActions): Promise<boolean> {
  try {
    // @tauri-apps/api v2 no longer ships the `os` module; the WebView user
    // agent reliably contains "Mac" on macOS.
    const isMac = /Mac/.test(navigator.userAgent);
    const mod = isMac ? "Cmd" : "Ctrl";
    const mi = (text: string, action: () => void) => MenuItem.new({ text, action: () => action() });

    const fileMenu = await Submenu.new({
      text: t("nmenu.file"),
      items: [
        await mi(t("nmenu.copy"), act.copy),
        await mi(t("nmenu.move"), act.move),
        await mi(t("nmenu.delete"), act.del),
        await mi(t("nmenu.rename"), act.rename),
        await mi(t("nmenu.mkdir"), act.mkdir),
        await PredefinedMenuItem.new({ item: "Separator" }),
        await mi(t("nmenu.openWith"), act.openWith),
        await mi(t("nmenu.props"), act.props),
      ],
    });

    const editMenu = await Submenu.new({
      text: t("nmenu.edit"),
      items: [
        await mi(t("nmenu.selectAll", { mod }), act.selectAll),
        await mi(t("nmenu.invertSel"), act.invertSel),
        await mi(t("nmenu.selPattern"), () => act.selPattern(true)),
        await mi(t("nmenu.deselPattern"), () => act.selPattern(false)),
      ],
    });

    const pathMenu = await Submenu.new({
      text: t("nmenu.path"),
      items: [
        await mi(t("nmenu.mcd"), act.mcd),
        await mi(t("nmenu.qcd"), act.qcd),
        await PredefinedMenuItem.new({ item: "Separator" }),
        await mi(t("nmenu.back"), act.back),
        await mi(t("nmenu.forward"), act.forward),
        await mi(t("nmenu.refresh"), act.refresh),
      ],
    });

    const archiveMenu = await Submenu.new({
      text: t("nmenu.archive"),
      items: [
        await mi(t("nmenu.zip"), act.zip),
        await mi(t("nmenu.unzip"), act.unzip),
        await mi(t("nmenu.zipview"), act.zipview),
        await PredefinedMenuItem.new({ item: "Separator" }),
        await mi(t("nmenu.split"), act.split),
      ],
    });

    const viewMenu = await Submenu.new({
      text: t("nmenu.view"),
      items: [
        await mi(t("nmenu.filter"), act.filter),
        await mi(t("nmenu.hidden"), act.toggleHidden),
        await mi(t("nmenu.fileList"), act.fileList),
      ],
    });

    const toolsMenu = await Submenu.new({
      text: t("nmenu.tools"),
      items: [
        await mi(t("nmenu.batchRename"), act.batchRename),
        await PredefinedMenuItem.new({ item: "Separator" }),
        await mi(t("nmenu.settings"), act.settings),
      ],
    });

    const helpMenu = await Submenu.new({
      text: t("nmenu.help"),
      items: [await mi(t("nmenu.helpItem"), act.help)],
    });

    const items: (Submenu | PredefinedMenuItem)[] = [];

    // macOS convention: first submenu is the application menu
    // (the OS displays the app name regardless of the title set here).
    if (isMac) {
      const appMenu = await Submenu.new({
        text: "Mdir4",
        items: [
          await PredefinedMenuItem.new({ item: { About: null }, text: t("nmenu.about") }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await mi(t("nmenu.settings"), act.settings),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await PredefinedMenuItem.new({ item: "Quit", text: t("nmenu.quit") }),
        ],
      });
      items.push(appMenu);
    }

    items.push(fileMenu, editMenu, pathMenu, archiveMenu, viewMenu, toolsMenu, helpMenu);

    const menu = await Menu.new({ items });
    await menu.setAsAppMenu();
    return true;
  } catch {
    return false;
  }
}
