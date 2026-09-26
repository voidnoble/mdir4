//! ZIP archive support: list, create, extract.
//!
//! Uses the `zip` crate natively (WinM used an internal ZIP engine too).
//! Progress is reported on the same `mdir4://fs-progress` channel as file ops,
//! with `op` set to `"zip"` / `"unzip"`.

use crate::fs::error::FsError;
use crate::fs::registry::OpRegistry;
use crate::fs::types::{OpSummary, OverwritePolicy, ProgressFn, ProgressPayload};
use serde::Serialize;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, State};
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

const CHUNK: usize = 8 * 1024 * 1024;

/// One entry inside a zip archive.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ZipEntry {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub compressed_size: u64,
}

/// List entries of a zip file (for the archive viewer).
pub fn zip_list(zip_path: &Path) -> Result<Vec<ZipEntry>, FsError> {
    let file = File::open(zip_path).map_err(|e| FsError::from_io(e, zip_path))?;
    let mut archive =
        ZipArchive::new(file).map_err(|e| FsError::internal(format!("zip 읽기 실패: {e}")))?;
    let mut out = Vec::with_capacity(archive.len());
    for i in 0..archive.len() {
        let entry = archive
            .by_index(i)
            .map_err(|e| FsError::internal(format!("zip 항목 읽기 실패: {e}")))?;
        out.push(ZipEntry {
            name: entry.name().to_string(),
            is_dir: entry.is_dir(),
            size: entry.size(),
            compressed_size: entry.compressed_size(),
        });
    }
    Ok(out)
}

fn check_cancel(cancel: &AtomicBool) -> Result<(), FsError> {
    if cancel.load(Ordering::Relaxed) {
        Err(FsError::cancelled())
    } else {
        Ok(())
    }
}

struct ProgressCtx<'a> {
    op_id: String,
    op: &'static str,
    files_done: usize,
    files_total: usize,
    bytes_done: u64,
    bytes_total: u64,
    progress: &'a ProgressFn,
    skipped: Vec<String>,
    errors: Vec<String>,
    cancelled: bool,
}

impl<'a> ProgressCtx<'a> {
    fn emit(&self, current_file: &str, done: bool) {
        (self.progress)(ProgressPayload {
            op_id: self.op_id.clone(),
            op: self.op.to_string(),
            current_file: current_file.to_string(),
            files_done: self.files_done,
            files_total: self.files_total,
            bytes_done: self.bytes_done,
            bytes_total: self.bytes_total,
            done,
        });
    }

    fn summary(&self) -> OpSummary {
        OpSummary {
            op_id: self.op_id.clone(),
            op: self.op.to_string(),
            files_done: self.files_done,
            files_total: self.files_total,
            bytes_done: self.bytes_done,
            bytes_total: self.bytes_total,
            skipped: self.skipped.clone(),
            errors: self.errors.clone(),
            cancelled: self.cancelled,
        }
    }
}

/// Total files + uncompressed bytes under `sources`.
fn compute_totals(sources: &[PathBuf]) -> (usize, u64) {
    let mut files = 0usize;
    let mut bytes = 0u64;
    for src in sources {
        if fs::symlink_metadata(src).is_err() {
            continue;
        }
        for entry in WalkDir::new(src).follow_links(false).into_iter().flatten() {
            if entry.file_type().is_file() && !entry.file_type().is_symlink() {
                files += 1;
                bytes += entry.metadata().map(|m| m.len()).unwrap_or(0);
            }
        }
    }
    (files, bytes)
}

fn zip_options() -> SimpleFileOptions {
    SimpleFileOptions::default().compression_method(CompressionMethod::Deflated)
}

/// Create a zip archive from `sources`. Each source lands at the archive root
/// under its own file name (WinM "압축하기" semantics).
pub fn zip_create(
    sources: &[PathBuf],
    dest_zip: &Path,
    op_id: &str,
    cancel: &AtomicBool,
    progress: &ProgressFn,
) -> Result<OpSummary, FsError> {
    if let Some(parent) = dest_zip.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| FsError::from_io(e, parent))?;
        }
    }
    let (files_total, bytes_total) = compute_totals(sources);
    let mut ctx = ProgressCtx {
        op_id: op_id.to_string(),
        op: "zip",
        files_done: 0,
        files_total,
        bytes_done: 0,
        bytes_total,
        progress,
        skipped: Vec::new(),
        errors: Vec::new(),
        cancelled: false,
    };
    ctx.emit("", false);

    let file = File::create(dest_zip).map_err(|e| FsError::from_io(e, dest_zip))?;
    let mut writer = ZipWriter::new(file);
    let options = zip_options();
    let mut buf = vec![0u8; CHUNK];

    let result: Result<(), FsError> = (|| {
        for src in sources {
            check_cancel(cancel)?;
            let root_name = src
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| "file".to_string());
            let meta = fs::symlink_metadata(src).map_err(|e| FsError::from_io(e, src))?;
            if meta.file_type().is_symlink() {
                ctx.skipped.push(src.to_string_lossy().into_owned());
                continue;
            }
            if meta.is_dir() {
                for entry in WalkDir::new(src).follow_links(false).min_depth(1) {
                    check_cancel(cancel)?;
                    let entry = entry.map_err(|e| {
                        FsError::internal(format!("스캔 실패: {e}"))
                    })?;
                    let rel = entry.path().strip_prefix(src).map_err(|_| {
                        FsError::internal("상대 경로 계산 실패")
                    })?;
                    let arc_name = format!(
                        "{}/{}",
                        root_name,
                        rel.to_string_lossy().replace('\\', "/")
                    );
                    let ft = entry.file_type();
                    if ft.is_dir() {
                        writer
                            .add_directory(format!("{arc_name}/"), options)
                            .map_err(|e| FsError::internal(format!("zip 쓰기 실패: {e}")))?;
                    } else if ft.is_file() {
                        write_file_entry(&mut writer, entry.path(), &arc_name, options, &mut buf, &mut ctx, cancel)?;
                    }
                    ctx.emit(&arc_name, false);
                }
            } else if meta.is_file() {
                write_file_entry(&mut writer, src, &root_name, options, &mut buf, &mut ctx, cancel)?;
                ctx.emit(&root_name, false);
            }
        }
        Ok(())
    })();

    match result {
        Ok(()) => {
            writer
                .finish()
                .map_err(|e| FsError::internal(format!("zip 완료 실패: {e}")))?;
            ctx.emit("", true);
            Ok(ctx.summary())
        }
        Err(e) => {
            if e.kind == "cancelled" {
                ctx.cancelled = true;
            } else {
                ctx.errors.push(e.message.clone());
            }
            let _ = writer.finish();
            let _ = fs::remove_file(dest_zip);
            ctx.emit("", true);
            if e.kind == "cancelled" {
                Ok(ctx.summary())
            } else {
                Err(e)
            }
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn write_file_entry<W: Write + std::io::Seek>(
    writer: &mut ZipWriter<W>,
    path: &Path,
    arc_name: &str,
    options: SimpleFileOptions,
    buf: &mut [u8],
    ctx: &mut ProgressCtx,
    cancel: &AtomicBool,
) -> Result<(), FsError> {
    writer
        .start_file(arc_name, options)
        .map_err(|e| FsError::internal(format!("zip 항목 시작 실패: {e}")))?;
    let mut f = File::open(path).map_err(|e| FsError::from_io(e, path))?;
    loop {
        check_cancel(cancel)?;
        let n = f.read(buf).map_err(|e| FsError::from_io(e, path))?;
        if n == 0 {
            break;
        }
        writer
            .write_all(&buf[..n])
            .map_err(|e| FsError::internal(format!("zip 쓰기 실패: {e}")))?;
        ctx.bytes_done += n as u64;
    }
    ctx.files_done += 1;
    Ok(())
}

fn free_name(dst: &Path) -> PathBuf {
    let parent = dst.parent().unwrap_or_else(|| Path::new("."));
    let stem = dst.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
    let ext = dst.extension().and_then(|s| s.to_str()).unwrap_or("");
    for i in 2.. {
        let name = if ext.is_empty() {
            format!("{stem} ({i})")
        } else {
            format!("{stem} ({i}).{ext}")
        };
        let candidate = parent.join(name);
        if fs::symlink_metadata(&candidate).is_err() {
            return candidate;
        }
    }
    unreachable!()
}

/// Extract a zip archive into `dest_dir`, applying `policy` on collisions.
pub fn zip_extract(
    zip_path: &Path,
    dest_dir: &Path,
    policy: OverwritePolicy,
    op_id: &str,
    cancel: &AtomicBool,
    progress: &ProgressFn,
) -> Result<OpSummary, FsError> {
    fs::create_dir_all(dest_dir).map_err(|e| FsError::from_io(e, dest_dir))?;
    let file = File::open(zip_path).map_err(|e| FsError::from_io(e, zip_path))?;
    let mut archive =
        ZipArchive::new(file).map_err(|e| FsError::internal(format!("zip 읽기 실패: {e}")))?;

    let files_total = archive.len();
    let bytes_total: u64 = {
        let mut total = 0u64;
        for i in 0..files_total {
            if let Ok(e) = archive.by_index(i) {
                total += e.size();
            }
        }
        total
    };
    let mut ctx = ProgressCtx {
        op_id: op_id.to_string(),
        op: "unzip",
        files_done: 0,
        files_total,
        bytes_done: 0,
        bytes_total,
        progress,
        skipped: Vec::new(),
        errors: Vec::new(),
        cancelled: false,
    };
    ctx.emit("", false);

    let mut buf = vec![0u8; CHUNK];
    for i in 0..files_total {
        if check_cancel(cancel).is_err() {
            ctx.cancelled = true;
            break;
        }
        let mut entry = match archive.by_index(i) {
            Ok(e) => e,
            Err(e) => {
                ctx.errors.push(format!("항목 읽기 실패: {e}"));
                ctx.files_done += 1;
                continue;
            }
        };
        let name = entry.name().to_string();
        let Some(safe_rel) = entry.enclosed_name() else {
            ctx.skipped.push(name);
            ctx.files_done += 1;
            continue;
        };
        let mut out_path = dest_dir.join(safe_rel);
        ctx.emit(&name, false);

        if entry.is_dir() {
            if let Err(e) = fs::create_dir_all(&out_path) {
                ctx.errors.push(format!("{}: {e}", out_path.display()));
            }
            ctx.files_done += 1;
            continue;
        }
        if let Some(parent) = out_path.parent() {
            if let Err(e) = fs::create_dir_all(parent) {
                ctx.errors.push(format!("{}: {e}", parent.display()));
                ctx.files_done += 1;
                continue;
            }
        }
        if fs::symlink_metadata(&out_path).is_ok() {
            match policy {
                OverwritePolicy::Overwrite | OverwritePolicy::Newer => {
                    let _ = fs::remove_file(&out_path);
                }
                OverwritePolicy::Skip => {
                    ctx.skipped.push(out_path.to_string_lossy().into_owned());
                    ctx.files_done += 1;
                    continue;
                }
                OverwritePolicy::Rename => {
                    out_path = free_name(&out_path);
                }
            }
        }
        let mut out = match File::create(&out_path) {
            Ok(f) => f,
            Err(e) => {
                ctx.errors.push(format!("{}: {e}", out_path.display()));
                ctx.files_done += 1;
                continue;
            }
        };
        let copy_result: Result<(), FsError> = (|| {
            loop {
                if cancel.load(Ordering::Relaxed) {
                    return Err(FsError::cancelled());
                }
                let n = entry.read(&mut buf).map_err(|e| FsError::internal(format!("zip 읽기 실패: {e}")))?;
                if n == 0 {
                    break;
                }
                out.write_all(&buf[..n])
                    .map_err(|e| FsError::from_io(e, &out_path))?;
                ctx.bytes_done += n as u64;
            }
            Ok(())
        })();
        match copy_result {
            Ok(()) => ctx.files_done += 1,
            Err(e) if e.kind == "cancelled" => {
                ctx.cancelled = true;
                let _ = fs::remove_file(&out_path);
                break;
            }
            Err(e) => {
                ctx.errors.push(e.message);
                ctx.files_done += 1;
            }
        }
    }
    ctx.emit("", true);
    Ok(ctx.summary())
}

/* ---------------- Tauri commands ---------------- */

fn emit_done(app: &AppHandle, summary: &OpSummary) {
    let _ = app.emit(
        "mdir4://fs-progress",
        ProgressPayload {
            op_id: summary.op_id.clone(),
            op: summary.op.clone(),
            current_file: String::new(),
            files_done: summary.files_done,
            files_total: summary.files_total,
            bytes_done: summary.bytes_done,
            bytes_total: summary.bytes_total,
            done: true,
        },
    );
}

#[tauri::command(rename_all = "camelCase")]
pub async fn fs_zip_list(zip_path: String) -> Result<Vec<ZipEntry>, FsError> {
    tauri::async_runtime::spawn_blocking(move || zip_list(Path::new(&zip_path)))
        .await
        .map_err(|_| FsError::internal("zip list task panicked"))?
}

#[tauri::command(rename_all = "camelCase")]
pub async fn fs_zip_create(
    app: AppHandle,
    state: State<'_, OpRegistry>,
    sources: Vec<String>,
    dest_zip: String,
    op_id: String,
) -> Result<OpSummary, FsError> {
    let cancel = state.register(&op_id);
    let oid = op_id.clone();
    let app2 = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let progress = move |p: ProgressPayload| {
            let _ = app2.emit("mdir4://fs-progress", p);
        };
        let sources: Vec<PathBuf> = sources.iter().map(PathBuf::from).collect();
        zip_create(&sources, Path::new(&dest_zip), &oid, &cancel, &progress)
    })
    .await
    .map_err(|_| FsError::internal("zip task panicked"))?;
    state.unregister(&op_id);
    if let Ok(summary) = &result {
        emit_done(&app, summary);
    }
    result
}

#[tauri::command(rename_all = "camelCase")]
pub async fn fs_zip_extract(
    app: AppHandle,
    state: State<'_, OpRegistry>,
    zip_path: String,
    dest_dir: String,
    policy: OverwritePolicy,
    op_id: String,
) -> Result<OpSummary, FsError> {
    let cancel = state.register(&op_id);
    let oid = op_id.clone();
    let app2 = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let progress = move |p: ProgressPayload| {
            let _ = app2.emit("mdir4://fs-progress", p);
        };
        zip_extract(Path::new(&zip_path), Path::new(&dest_dir), policy, &oid, &cancel, &progress)
    })
    .await
    .map_err(|_| FsError::internal("unzip task panicked"))?;
    state.unregister(&op_id);
    if let Ok(summary) = &result {
        emit_done(&app, summary);
    }
    result
}
