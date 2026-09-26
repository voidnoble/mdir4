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
    return { ...defaultConfig, ...cfg };
  } catch {
    return { ...defaultConfig };
  }
}

export async function saveConfig(cfg: AppConfig): Promise<void> {
  await invoke("config_save", { config: cfg });
}
