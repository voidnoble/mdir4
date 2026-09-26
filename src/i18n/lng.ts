/** WinM .lng parser: `[Main]` + `[Messages]` with numeric IDs.
 *  `&` marks hotkeys, `|` is a line break, `%S` is a parameter.
 */

export interface ParsedLng {
  main: Record<string, string>;
  messages: Map<number, string>;
}

export function parseLng(text: string): ParsedLng {
  const main: Record<string, string> = {};
  const messages = new Map<number, string>();
  let section = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(";")) continue;
    const sec = line.match(/^\[(.+)\]$/);
    if (sec) {
      section = sec[1];
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1);
    if (section === "Main") {
      main[key] = val;
    } else if (section === "Messages") {
      const id = parseInt(key, 10);
      if (!Number.isNaN(id)) messages.set(id, cleanLng(val));
    }
  }
  return { main, messages };
}

/** Strip hotkey markers, turn `|` into newlines. */
export function cleanLng(s: string): string {
  return s.replace(/&/g, "").replace(/\|/g, "\n");
}

/** WinM message ID -> Mdir4 i18n key (curated subset for community language packs). */
export const WINM_LNG_MAP: Record<number, string> = {
  1: "dlg.ok",
  2: "dlg.cancel",
  3: "dlg.save", // Apply
  4: "dlg.close",
  6: "dlg.yes",
  7: "dlg.no",
  1002: "keybar.copy",
  1003: "keybar.rename", // Move (closest)
  1004: "keybar.delete",
  1005: "keybar.rename",
  1006: "keybar.mkdir",
  1000: "menu.file",
  1444: "keybar.refresh",
  1421: "settings.showHidden",
  2021: "keybar.refresh",
};

/** Convert a parsed WinM .lng into an Mdir4 dictionary for the mapped keys. */
export function lngToDict(parsed: ParsedLng): Record<string, string> {
  const dict: Record<string, string> = {};
  for (const [id, key] of Object.entries(WINM_LNG_MAP)) {
    const msg = parsed.messages.get(Number(id));
    if (msg) dict[key] = msg;
  }
  return dict;
}
