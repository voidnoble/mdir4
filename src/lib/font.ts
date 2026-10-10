import { invoke } from "@tauri-apps/api/core";

export interface FontSelection {
  name: string;
  /** CSS pixel size, matching the persisted settings format. */
  size: number;
}

/** Open the platform-native font chooser. A null result means the user cancelled. */
export function selectFont(initial: FontSelection): Promise<FontSelection | null> {
  return invoke<FontSelection | null>("font_select", { initial });
}
