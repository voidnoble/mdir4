//! File split / combine with CRC32 (WinM TSplitForm/TSplitCombineForm equivalent).
//!
//! Split: `name.ext` -> `name.ext.001`, `name.ext.002`, … + `name.ext.crc` sidecar.
//! Combine: reads `.001` and following parts, verifies CRC32 against the sidecar.

use crate::fs::error::FsError;
use crate::fs::registry::OpRegistry;
use crate::fs::types::{OpSummary, ProgressFn, ProgressPayload};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, State};

const CHUNK: usize = 8 * 1024 * 1024;

/* ---------------- CRC32 (IEEE) ---------------- */

fn crc32_table() -> [u32; 256] {
    let mut t = [0u32; 256];
    for i in 0..256 {
        let mut c = i as u32;
        for _ in 0..8 {
            c = if c & 1 == 1 {
                0xEDB88320 ^ (c >> 1)
            } else {
                c >> 1
            };
        }
        t[i] = c;
    }
    t
}

fn crc32_update(table: &[u32; 256], mut crc: u32, buf: &[u8]) -> u32 {
    for &b in buf {
        crc = table[((crc ^ b as u32) & 0xFF) as usize] ^ (crc >> 8);
    }
    crc
}

/* ---------------- progress ---------------- */

struct ProgressCtx<'a> {
    op_id: String,
    op: &'static str,
    files_done: usize,
    files_total: usize,
    bytes_done: u64,
    bytes_total: u64,
    progress: &'a ProgressFn,
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
            skipped: Vec::new(),
            errors: self.errors.clone(),
            cancelled: self.cancelled,
        }
    }
}

fn check_cancel(cancel: &AtomicBool) -> Result<(), FsError> {
    if cancel.load(Ordering::Relaxed) {
        Err(FsError::cancelled())
    } else {
        Ok(())
    }
}

/// Split `src` into `chunk_size`-byte parts under `dest_dir`.
/// Returns the part paths. Writes `<name>.crc` with the source CRC32.
pub fn split_file(
    src: &Path,
    dest_dir: &Path,
    chunk_size: u64,
    op_id: &str,
    cancel: &AtomicBool,
    progress: &ProgressFn,
) -> Result<Vec<PathBuf>, FsError> {
    if chunk_size == 0 {
        return Err(FsError::internal("분할 크기는 0보다 커야 합니다"));
    }
    let meta = fs::metadata(src).map_err(|e| FsError::from_io(e, src))?;
    if !meta.is_file() {
        return Err(FsError::internal("파일만 분할할 수 있습니다"));
    }
    fs::create_dir_all(dest_dir).map_err(|e| FsError::from_io(e, dest_dir))?;
    let total = meta.len();
    let file_name = src
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "file".to_string());

    let mut ctx = ProgressCtx {
        op_id: op_id.to_string(),
        op: "split",
        files_done: 0,
        files_total: 1,
        bytes_done: 0,
        bytes_total: total,
        progress,
        errors: Vec::new(),
        cancelled: false,
    };
    ctx.emit(&file_name, false);

    let table = crc32_table();
    let mut crc: u32 = 0xFFFF_FFFF;
    let mut input = File::open(src).map_err(|e| FsError::from_io(e, src))?;
    let mut buf = vec![0u8; CHUNK];
    let mut parts: Vec<PathBuf> = Vec::new();
    let mut part_no = 0u32;
    let mut written_parts: Vec<PathBuf> = Vec::new();

    let result: Result<(), FsError> = (|| {
        loop {
            check_cancel(cancel)?;
            let part_path = dest_dir.join(format!("{file_name}.{:03}", part_no + 1));
            let mut out = File::create(&part_path).map_err(|e| FsError::from_io(e, &part_path))?;
            let mut left = chunk_size;
            let mut wrote_any = false;
            while left > 0 {
                let want = (left.min(CHUNK as u64)) as usize;
                let n = input
                    .read(&mut buf[..want])
                    .map_err(|e| FsError::from_io(e, src))?;
                if n == 0 {
                    break;
                }
                crc = crc32_update(&table, crc, &buf[..n]);
                out.write_all(&buf[..n])
                    .map_err(|e| FsError::from_io(e, &part_path))?;
                left -= n as u64;
                ctx.bytes_done += n as u64;
                wrote_any = true;
                ctx.emit(&file_name, false);
            }
            if !wrote_any {
                let _ = fs::remove_file(&part_path);
                break;
            }
            written_parts.push(part_path.clone());
            parts.push(part_path);
            part_no += 1;
            if ctx.bytes_done >= total {
                break;
            }
        }
        Ok(())
    })();

    match result {
        Ok(()) => {
            let final_crc = crc ^ 0xFFFF_FFFF;
            let crc_path = dest_dir.join(format!("{file_name}.crc"));
            let _ = fs::write(&crc_path, format!("{final_crc:08X}"));
            ctx.files_done = 1;
            ctx.emit("", true);
            Ok(parts)
        }
        Err(e) => {
            for p in &written_parts {
                let _ = fs::remove_file(p);
            }
            if e.kind == "cancelled" {
                ctx.cancelled = true;
                ctx.emit("", true);
            }
            Err(e)
        }
    }
}

/// Find part files `<stem>.001`, `<stem>.002`, … next to `first_part`.
fn find_parts(first_part: &Path) -> Result<Vec<PathBuf>, FsError> {
    let name = first_part
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .ok_or_else(|| FsError::internal("잘못된 분할 파일 이름"))?;
    let Some(dot) = name.rfind('.') else {
        return Err(FsError::internal("분할 파일 이름 형식이 아닙니다 (.001)"));
    };
    let (stem, num) = name.split_at(dot);
    if num.len() != 4 || !num[1..].chars().all(|c| c.is_ascii_digit()) {
        return Err(FsError::internal("분할 파일 이름 형식이 아닙니다 (.001)"));
    }
    let parent = first_part.parent().unwrap_or_else(|| Path::new("."));
    let mut parts = Vec::new();
    for i in 1.. {
        let candidate = parent.join(format!("{stem}.{i:03}"));
        if candidate.exists() {
            parts.push(candidate);
        } else {
            break;
        }
    }
    if parts.is_empty() {
        return Err(FsError::internal("분할 파일을 찾을 수 없습니다"));
    }
    Ok(parts)
}

/// Combine parts starting at `first_part` into `dest_path`, verifying CRC32.
pub fn combine_files(
    first_part: &Path,
    dest_path: &Path,
    op_id: &str,
    cancel: &AtomicBool,
    progress: &ProgressFn,
) -> Result<(), FsError> {
    let parts = find_parts(first_part)?;
    let total: u64 = parts
        .iter()
        .map(|p| fs::metadata(p).map(|m| m.len()).unwrap_or(0))
        .sum();

    // expected CRC from sidecar: <stem>.crc next to parts
    let name = first_part
        .file_name()
        .unwrap()
        .to_string_lossy()
        .into_owned();
    let stem = &name[..name.rfind('.').unwrap()];
    let crc_path = first_part
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join(format!("{stem}.crc"));
    let expected_crc: Option<u32> = fs::read_to_string(&crc_path)
        .ok()
        .and_then(|s| u32::from_str_radix(s.trim(), 16).ok());

    let mut ctx = ProgressCtx {
        op_id: op_id.to_string(),
        op: "combine",
        files_done: 0,
        files_total: parts.len(),
        bytes_done: 0,
        bytes_total: total,
        progress,
        errors: Vec::new(),
        cancelled: false,
    };
    ctx.emit(&stem.to_string(), false);

    if let Some(parent) = dest_path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| FsError::from_io(e, parent))?;
        }
    }
    let table = crc32_table();
    let mut crc: u32 = 0xFFFF_FFFF;
    let mut out = File::create(dest_path).map_err(|e| FsError::from_io(e, dest_path))?;
    let mut buf = vec![0u8; CHUNK];

    let result: Result<(), FsError> = (|| {
        for part in &parts {
            check_cancel(cancel)?;
            ctx.emit(&part.to_string_lossy().into_owned(), false);
            let mut f = File::open(part).map_err(|e| FsError::from_io(e, part))?;
            loop {
                check_cancel(cancel)?;
                let n = f.read(&mut buf).map_err(|e| FsError::from_io(e, part))?;
                if n == 0 {
                    break;
                }
                crc = crc32_update(&table, crc, &buf[..n]);
                out.write_all(&buf[..n])
                    .map_err(|e| FsError::from_io(e, dest_path))?;
                ctx.bytes_done += n as u64;
            }
            ctx.files_done += 1;
        }
        Ok(())
    })();

    match result {
        Ok(()) => {
            let final_crc = crc ^ 0xFFFF_FFFF;
            if let Some(expected) = expected_crc {
                if expected != final_crc {
                    let _ = fs::remove_file(dest_path);
                    return Err(FsError::internal(format!(
                        "CRC 불일치: 예상 {expected:08X}, 실제 {final_crc:08X}"
                    )));
                }
            }
            ctx.emit("", true);
            Ok(())
        }
        Err(e) => {
            let _ = fs::remove_file(dest_path);
            if e.kind == "cancelled" {
                ctx.cancelled = true;
                ctx.emit("", true);
            }
            Err(e)
        }
    }
}

#[tauri::command(rename_all = "camelCase")]
pub async fn fs_split(
    app: AppHandle,
    state: State<'_, OpRegistry>,
    path: String,
    dest_dir: String,
    chunk_size: u64,
    op_id: String,
) -> Result<Vec<String>, FsError> {
    let cancel = state.register(&op_id);
    let oid = op_id.clone();
    let app2 = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let progress = move |p: ProgressPayload| {
            let _ = app2.emit("mdir4://fs-progress", p);
        };
        split_file(
            Path::new(&path),
            Path::new(&dest_dir),
            chunk_size,
            &oid,
            &cancel,
            &progress,
        )
    })
    .await
    .map_err(|_| FsError::internal("split task panicked"))?;
    state.unregister(&op_id);
    result.map(|parts| {
        parts
            .iter()
            .map(|p| p.to_string_lossy().into_owned())
            .collect()
    })
}

#[tauri::command(rename_all = "camelCase")]
pub async fn fs_combine(
    app: AppHandle,
    state: State<'_, OpRegistry>,
    first_part: String,
    dest_path: String,
    op_id: String,
) -> Result<(), FsError> {
    let cancel = state.register(&op_id);
    let oid = op_id.clone();
    let app2 = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let progress = move |p: ProgressPayload| {
            let _ = app2.emit("mdir4://fs-progress", p);
        };
        combine_files(
            Path::new(&first_part),
            Path::new(&dest_path),
            &oid,
            &cancel,
            &progress,
        )
    })
    .await
    .map_err(|_| FsError::internal("combine task panicked"))?;
    state.unregister(&op_id);
    result
}
