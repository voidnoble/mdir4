import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface FsEntry {
  name: string;
  path: string;
  isDir: boolean;
  isSymlink: boolean;
  size: number;
  modifiedMs: number | null;
  readonly: boolean;
  hidden: boolean;
}

export type OverwritePolicy = "overwrite" | "skip" | "rename" | "newer";

export interface OpSummary {
  opId: string;
  op: string;
  filesDone: number;
  filesTotal: number;
  bytesDone: number;
  bytesTotal: number;
  skipped: string[];
  errors: string[];
  cancelled: boolean;
}

export interface ProgressPayload extends Omit<OpSummary, "skipped" | "errors" | "cancelled"> {
  currentFile: string;
  done: boolean;
}

export interface FsErrorShape {
  kind: "notFound" | "permission" | "alreadyExists" | "cancelled" | "internal" | "io";
  path?: string;
  message: string;
}

export const FS_PROGRESS_EVENT = "mdir4://fs-progress";

function parseFsError(e: unknown): FsErrorShape {
  if (typeof e === "string") {
    try {
      return JSON.parse(e) as FsErrorShape;
    } catch {
      return { kind: "io", message: e };
    }
  }
  return { kind: "io", message: String(e) };
}

export async function fsList(path: string): Promise<FsEntry[]> {
  try {
    return await invoke<FsEntry[]>("fs_list", { path });
  } catch (e) {
    throw parseFsError(e);
  }
}

export async function fsCopy(
  sources: string[],
  destDir: string,
  policy: OverwritePolicy,
  opId: string,
): Promise<OpSummary> {
  try {
    return await invoke<OpSummary>("fs_copy", { sources, destDir, policy, opId });
  } catch (e) {
    throw parseFsError(e);
  }
}

export async function fsMove(
  sources: string[],
  destDir: string,
  policy: OverwritePolicy,
  opId: string,
): Promise<OpSummary> {
  try {
    return await invoke<OpSummary>("fs_move", { sources, destDir, policy, opId });
  } catch (e) {
    throw parseFsError(e);
  }
}

export async function fsDelete(paths: string[], permanent: boolean, opId: string): Promise<OpSummary> {
  try {
    return await invoke<OpSummary>("fs_delete", { paths, permanent, opId });
  } catch (e) {
    throw parseFsError(e);
  }
}

export async function fsMakeDir(path: string): Promise<void> {
  try {
    await invoke("fs_make_dir", { path });
  } catch (e) {
    throw parseFsError(e);
  }
}

export async function fsRename(path: string, newName: string): Promise<void> {
  try {
    await invoke("fs_rename", { path, newName });
  } catch (e) {
    throw parseFsError(e);
  }
}

export async function fsCancel(opId: string): Promise<boolean> {
  return invoke<boolean>("fs_cancel", { opId });
}

export async function fsHome(): Promise<string> {
  return invoke<string>("fs_home");
}

export interface ConflictInfo {
  source: string;
  dest: string;
  isDir: boolean;
}

export async function fsCheckConflicts(sources: string[], destDir: string): Promise<ConflictInfo[]> {
  try {
    return await invoke<ConflictInfo[]>("fs_check_conflicts", { sources, destDir });
  } catch (e) {
    throw parseFsError(e);
  }
}

export interface ZipEntry {
  name: string;
  isDir: boolean;
  size: number;
  compressedSize: number;
}

export async function fsZipList(zipPath: string): Promise<ZipEntry[]> {
  try {
    return await invoke<ZipEntry[]>("fs_zip_list", { zipPath });
  } catch (e) {
    throw parseFsError(e);
  }
}

export async function fsZipCreate(sources: string[], destZip: string, opId: string): Promise<OpSummary> {
  try {
    return await invoke<OpSummary>("fs_zip_create", { sources, destZip, opId });
  } catch (e) {
    throw parseFsError(e);
  }
}

export async function fsZipExtract(
  zipPath: string,
  destDir: string,
  policy: OverwritePolicy,
  opId: string,
): Promise<OpSummary> {
  try {
    return await invoke<OpSummary>("fs_zip_extract", { zipPath, destDir, policy, opId });
  } catch (e) {
    throw parseFsError(e);
  }
}

export function onFsProgress(handler: (p: ProgressPayload) => void): Promise<UnlistenFn> {
  return listen<ProgressPayload>(FS_PROGRESS_EVENT, (e) => handler(e.payload));
}

export function newOpId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/* ---------------- tree (MCD) ---------------- */

export interface TreeNode {
  path: string;
  name: string;
  hasChildren: boolean;
}

export async function fsRoots(): Promise<TreeNode[]> {
  return invoke<TreeNode[]>("fs_roots");
}

export async function fsTreeChildren(path: string): Promise<TreeNode[]> {
  return invoke<TreeNode[]>("fs_tree_children", { path });
}

/* ---------------- split / combine ---------------- */

export async function fsSplit(
  path: string,
  destDir: string,
  chunkSize: number,
  opId: string,
): Promise<string[]> {
  try {
    return await invoke<string[]>("fs_split", { path, destDir, chunkSize, opId });
  } catch (e) {
    throw parseFsError(e);
  }
}

export async function fsCombine(firstPart: string, destPath: string, opId: string): Promise<void> {
  try {
    await invoke<void>("fs_combine", { firstPart, destPath, opId });
  } catch (e) {
    throw parseFsError(e);
  }
}

/** true when the file looks like a split part: name.001 */
export function isSplitPart(name: string): boolean {
  return /\.\d{3}$/i.test(name);
}

/** Strip the .NNN suffix → original name suggestion. */
export function unsplitName(name: string): string {
  return name.replace(/\.\d{3}$/i, "");
}

/* ---------------- P6: props / descript.ion / shell ---------------- */

export interface DirSize {
  files: number;
  dirs: number;
  bytes: number;
}

export interface FileProps {
  size: number;
  isDir: boolean;
  readonly: boolean;
  hidden: boolean;
  modified: number;
  accessed: number | null;
  created: number | null;
}

export async function fsDirSize(path: string): Promise<DirSize> {
  try {
    return await invoke<DirSize>("fs_dir_size", { path });
  } catch (e) {
    throw parseFsError(e);
  }
}

export async function fsFileProps(path: string): Promise<FileProps> {
  try {
    return await invoke<FileProps>("fs_file_props", { path });
  } catch (e) {
    throw parseFsError(e);
  }
}

export async function fsSetReadonly(path: string, readonly: boolean): Promise<void> {
  try {
    await invoke<void>("fs_set_readonly", { path, readonly });
  } catch (e) {
    throw parseFsError(e);
  }
}

export async function fsSetMtime(path: string, unixSecs: number): Promise<void> {
  try {
    await invoke<void>("fs_set_mtime", { path, unixSecs });
  } catch (e) {
    throw parseFsError(e);
  }
}

export async function fsDescGet(dir: string, name: string): Promise<string | null> {
  try {
    return await invoke<string | null>("fs_desc_get", { dir, name });
  } catch (e) {
    throw parseFsError(e);
  }
}

export async function fsDescSet(dir: string, name: string, desc: string): Promise<void> {
  try {
    await invoke<void>("fs_desc_set", { dir, name, desc });
  } catch (e) {
    throw parseFsError(e);
  }
}

export async function fsShellOpen(path: string, program?: string): Promise<void> {
  try {
    await invoke<void>("fs_shell_open", { path, program: program ?? null });
  } catch (e) {
    throw parseFsError(e);
  }
}

export async function fsWriteText(path: string, text: string): Promise<void> {
  try {
    await invoke<void>("fs_write_text", { path, text });
  } catch (e) {
    throw parseFsError(e);
  }
}

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export async function fsExec(program: string, args: string[], cwd: string): Promise<ExecResult> {
  try {
    return await invoke<ExecResult>("fs_exec", { program, args, cwd });
  } catch (e) {
    throw parseFsError(e);
  }
}
