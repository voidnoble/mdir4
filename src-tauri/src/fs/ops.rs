use super::error::FsError;
use super::types::{ConflictInfo, OpSummary, OverwritePolicy, ProgressFn, ProgressPayload};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use walkdir::WalkDir;

const CHUNK: usize = 8 * 1024 * 1024;

/// Mutable progress state shared across one operation.
struct ProgressCtx<'a> {
    op_id: String,
    op: &'static str,
    files_done: usize,
    files_total: usize,
    bytes_done: u64,
    bytes_total: u64,
    progress: &'a ProgressFn,
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

    /// A throwaway context that counts nothing and emits nothing.
    fn silent() -> ProgressCtx<'static> {
        fn noop(_: ProgressPayload) {}
        ProgressCtx {
            op_id: String::new(),
            op: "",
            files_done: 0,
            files_total: 0,
            bytes_done: 0,
            bytes_total: 0,
            progress: &noop,
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

/// Count files + bytes under `sources` (top-level symlinks count as 1 file, 0 bytes).
fn compute_totals(sources: &[PathBuf]) -> (usize, u64) {
    let mut files = 0usize;
    let mut bytes = 0u64;
    for src in sources {
        if fs::symlink_metadata(src).is_err() {
            continue;
        }
        for entry in WalkDir::new(src).follow_links(false).into_iter().flatten() {
            if entry.file_type().is_symlink() {
                files += 1;
                continue;
            }
            if entry.file_type().is_file() {
                files += 1;
                bytes += entry.metadata().map(|m| m.len()).unwrap_or(0);
            }
        }
    }
    (files, bytes)
}

/// Resolve `dst` when it already exists, according to `policy`.
/// Returns `None` when the item must be skipped.
fn resolve_conflict(dst: &Path, src: &Path, policy: OverwritePolicy) -> Option<PathBuf> {
    if fs::symlink_metadata(dst).is_err() {
        return Some(dst.to_path_buf());
    }
    match policy {
        OverwritePolicy::Overwrite => {
            let is_real_dir =
                dst.is_dir() && !fs::symlink_metadata(dst).map(|m| m.file_type().is_symlink()).unwrap_or(true);
            if is_real_dir {
                let _ = fs::remove_dir_all(dst);
            } else {
                let _ = fs::remove_file(dst);
            }
            Some(dst.to_path_buf())
        }
        OverwritePolicy::Skip => None,
        OverwritePolicy::Rename => Some(free_name(dst)),
        OverwritePolicy::Newer => {
            let src_newer = match (
                fs::metadata(src).and_then(|m| m.modified()),
                fs::metadata(dst).and_then(|m| m.modified()),
            ) {
                (Ok(s), Ok(d)) => s >= d,
                _ => true,
            };
            if src_newer {
                if dst.is_dir() {
                    let _ = fs::remove_dir_all(dst);
                } else {
                    let _ = fs::remove_file(dst);
                }
                Some(dst.to_path_buf())
            } else {
                None
            }
        }
    }
}

/// "photo.jpg" -> "photo (2).jpg", "photo (3).jpg", ...
fn free_name(dst: &Path) -> PathBuf {
    let parent = dst.parent().unwrap_or_else(|| Path::new("."));
    let stem = dst.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
    let ext = dst.extension().and_then(|s| s.to_str()).unwrap_or("");
    for i in 2.. {
        let name = if ext.is_empty() {
            format!("{} ({})", stem, i)
        } else {
            format!("{} ({}).{}", stem, i, ext)
        };
        let candidate = parent.join(name);
        if fs::symlink_metadata(&candidate).is_err() {
            return candidate;
        }
    }
    unreachable!()
}

fn copy_file_chunked(
    src: &Path,
    dst: &Path,
    cancel: &AtomicBool,
    ctx: &mut ProgressCtx,
) -> Result<(), FsError> {
    let mut reader = File::open(src).map_err(|e| FsError::from_io(e, src))?;
    let mut writer = File::create(dst).map_err(|e| FsError::from_io(e, dst))?;
    let mut buf = vec![0u8; CHUNK];
    loop {
        check_cancel(cancel)?;
        let n = reader.read(&mut buf).map_err(|e| FsError::from_io(e, src))?;
        if n == 0 {
            break;
        }
        writer.write_all(&buf[..n]).map_err(|e| FsError::from_io(e, dst))?;
        ctx.bytes_done += n as u64;
        ctx.emit(&src.to_string_lossy(), false);
    }
    writer.flush().map_err(|e| FsError::from_io(e, dst))?;
    ctx.files_done += 1;
    Ok(())
}

fn copy_symlink(src: &Path, dst: &Path, ctx: &mut ProgressCtx) -> Result<(), FsError> {
    let target = fs::read_link(src).map_err(|e| FsError::from_io(e, src))?;
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(&target, dst).map_err(|e| FsError::from_io(e, dst))?;
        ctx.files_done += 1;
        Ok(())
    }
    #[cfg(not(unix))]
    {
        let _ = target;
        Err(FsError {
            kind: "skipped".to_string(),
            path: Some(src.to_string_lossy().into_owned()),
            message: "symlinks are not replicated on this platform (P1)".to_string(),
        })
    }
}

fn copy_recursive(
    src: &Path,
    dst: &Path,
    cancel: &AtomicBool,
    ctx: &mut ProgressCtx,
) -> Result<(), FsError> {
    check_cancel(cancel)?;
    let meta = fs::symlink_metadata(src).map_err(|e| FsError::from_io(e, src))?;
    let ft = meta.file_type();

    if ft.is_symlink() {
        return copy_symlink(src, dst, ctx);
    }
    if ft.is_dir() {
        fs::create_dir_all(dst).map_err(|e| FsError::from_io(e, dst))?;
        for entry in fs::read_dir(src).map_err(|e| FsError::from_io(e, src))? {
            let entry = entry.map_err(|e| FsError::from_io(e, src))?;
            copy_recursive(&entry.path(), &dst.join(entry.file_name()), cancel, ctx)?;
        }
        return Ok(());
    }
    copy_file_chunked(src, dst, cancel, ctx)
}

fn copy_one(
    src: &Path,
    dst_dir: &Path,
    policy: OverwritePolicy,
    cancel: &AtomicBool,
    ctx: &mut ProgressCtx,
    summary: &mut OpSummary,
) {
    let file_name = match src.file_name() {
        Some(n) => n,
        None => {
            summary.errors.push(format!("invalid source name: {}", src.display()));
            return;
        }
    };
    let dst = dst_dir.join(file_name);
    let dst = match resolve_conflict(&dst, src, policy) {
        Some(d) => d,
        None => {
            summary.skipped.push(src.to_string_lossy().into_owned());
            return;
        }
    };

    match copy_recursive(src, &dst, cancel, ctx) {
        Ok(()) => ctx.emit(&src.to_string_lossy(), false),
        Err(e) if e.kind == "cancelled" => summary.cancelled = true,
        Err(e) if e.kind == "skipped" => summary.skipped.push(e.path.unwrap_or_default()),
        Err(e) => summary.errors.push(format!("{}: {}", src.display(), e.message)),
    }
}

/// Copy `sources` into `dest_dir`.
pub fn copy_items(
    sources: &[PathBuf],
    dest_dir: &Path,
    policy: OverwritePolicy,
    op_id: &str,
    cancel: &AtomicBool,
    progress: &ProgressFn,
) -> Result<OpSummary, FsError> {
    if !dest_dir.is_dir() {
        return Err(FsError::from_io(
            std::io::Error::new(std::io::ErrorKind::NotFound, "destination is not a folder"),
            dest_dir,
        ));
    }
    let (files_total, bytes_total) = compute_totals(sources);
    let mut ctx = ProgressCtx {
        op_id: op_id.to_string(),
        op: "copy",
        files_done: 0,
        files_total,
        bytes_done: 0,
        bytes_total,
        progress,
    };
    let mut summary = OpSummary {
        op_id: op_id.to_string(),
        op: "copy".to_string(),
        files_done: 0,
        files_total,
        bytes_done: 0,
        bytes_total,
        skipped: vec![],
        errors: vec![],
        cancelled: false,
    };
    ctx.emit("", false);
    for src in sources {
        if summary.cancelled {
            break;
        }
        copy_one(src, dest_dir, policy, cancel, &mut ctx, &mut summary);
    }
    summary.files_done = ctx.files_done;
    summary.bytes_done = ctx.bytes_done;
    ctx.emit("", true);
    Ok(summary)
}

/// Move `sources` into `dest_dir`. Fast rename when possible,
/// otherwise copy + permanent delete of the source.
pub fn move_items(
    sources: &[PathBuf],
    dest_dir: &Path,
    policy: OverwritePolicy,
    op_id: &str,
    cancel: &AtomicBool,
    progress: &ProgressFn,
) -> Result<OpSummary, FsError> {
    if !dest_dir.is_dir() {
        return Err(FsError::from_io(
            std::io::Error::new(std::io::ErrorKind::NotFound, "destination is not a folder"),
            dest_dir,
        ));
    }
    let (files_total, bytes_total) = compute_totals(sources);
    let mut ctx = ProgressCtx {
        op_id: op_id.to_string(),
        op: "move",
        files_done: 0,
        files_total,
        bytes_done: 0,
        bytes_total,
        progress,
    };
    let mut summary = OpSummary {
        op_id: op_id.to_string(),
        op: "move".to_string(),
        files_done: 0,
        files_total,
        bytes_done: 0,
        bytes_total,
        skipped: vec![],
        errors: vec![],
        cancelled: false,
    };
    ctx.emit("", false);

    for src in sources {
        if summary.cancelled {
            break;
        }
        let file_name = match src.file_name() {
            Some(n) => n,
            None => {
                summary.errors.push(format!("invalid source name: {}", src.display()));
                continue;
            }
        };
        let dst = dest_dir.join(file_name);
        let dst = match resolve_conflict(&dst, src, policy) {
            Some(d) => d,
            None => {
                summary.skipped.push(src.to_string_lossy().into_owned());
                continue;
            }
        };
        // Fast path: same-filesystem rename.
        let (tree_files, _) = compute_totals(std::slice::from_ref(src));
        match fs::rename(src, &dst) {
            Ok(()) => {
                ctx.files_done += tree_files;
                ctx.emit(&src.to_string_lossy(), false);
                continue;
            }
            Err(e) if e.kind() == std::io::ErrorKind::CrossesDevices => { /* slow path */ }
            Err(e) => {
                summary.errors.push(format!("{}: {}", src.display(), e));
                continue;
            }
        }
        // Slow path: copy, then delete the source without double-counting.
        let mut silent = ProgressCtx::silent();
        match copy_recursive(src, &dst, cancel, &mut ctx) {
            Ok(()) => match delete_permanent(src, cancel, &mut silent) {
                Ok(()) => ctx.emit(&src.to_string_lossy(), false),
                Err(e) => summary
                    .errors
                    .push(format!("{} (delete after copy): {}", src.display(), e.message)),
            },
            Err(e) if e.kind == "cancelled" => summary.cancelled = true,
            Err(e) if e.kind == "skipped" => summary.skipped.push(e.path.unwrap_or_default()),
            Err(e) => summary.errors.push(format!("{}: {}", src.display(), e.message)),
        }
    }
    summary.files_done = ctx.files_done;
    summary.bytes_done = ctx.bytes_done;
    ctx.emit("", true);
    Ok(summary)
}

/// Permanently delete one path (file, symlink, or dir tree).
fn delete_permanent(path: &Path, cancel: &AtomicBool, ctx: &mut ProgressCtx) -> Result<(), FsError> {
    let meta = fs::symlink_metadata(path).map_err(|e| FsError::from_io(e, path))?;
    if meta.file_type().is_dir() && !meta.file_type().is_symlink() {
        for entry in WalkDir::new(path).contents_first(true).into_iter().flatten() {
            check_cancel(cancel)?;
            let p = entry.path();
            // contents_first removes children before parents; the root dir
            // itself is removed last by remove_dir. Only files count toward
            // progress, matching compute_totals().
            let is_dir = entry.file_type().is_dir();
            let r = if is_dir { fs::remove_dir(p) } else { fs::remove_file(p) };
            if let Err(e) = r {
                return Err(FsError::from_io(e, p));
            }
            if !is_dir {
                ctx.files_done += 1;
            }
            ctx.emit(&p.to_string_lossy(), false);
        }
        Ok(())
    } else {
        check_cancel(cancel)?;
        fs::remove_file(path).map_err(|e| FsError::from_io(e, path))?;
        ctx.files_done += 1;
        ctx.emit(&path.to_string_lossy(), false);
        Ok(())
    }
}

/// Delete `paths`: to the recycle bin (`permanent = false`) or permanently.
pub fn delete_items(
    paths: &[PathBuf],
    permanent: bool,
    op_id: &str,
    cancel: &AtomicBool,
    progress: &ProgressFn,
) -> Result<OpSummary, FsError> {
    let files_total = if permanent { compute_totals(paths).0 } else { paths.len() };
    let mut ctx = ProgressCtx {
        op_id: op_id.to_string(),
        op: "delete",
        files_done: 0,
        files_total,
        bytes_done: 0,
        bytes_total: 0,
        progress,
    };
    let mut summary = OpSummary {
        op_id: op_id.to_string(),
        op: "delete".to_string(),
        files_done: 0,
        files_total,
        bytes_done: 0,
        bytes_total: 0,
        skipped: vec![],
        errors: vec![],
        cancelled: false,
    };
    ctx.emit("", false);

    for path in paths {
        if summary.cancelled {
            break;
        }
        let result = if permanent {
            delete_permanent(path, cancel, &mut ctx).map_err(|e| e.message)
        } else {
            check_cancel(cancel)
                .map_err(|e| e.message)
                .and_then(|()| trash::delete(path).map_err(|e| e.to_string()))
                .map(|()| {
                    ctx.files_done += 1;
                    ctx.emit(&path.to_string_lossy(), false);
                })
        };
        match result {
            Ok(()) => {}
            Err(msg) if msg == "operation cancelled" => summary.cancelled = true,
            Err(msg) => summary.errors.push(format!("{}: {}", path.display(), msg)),
        }
    }
    summary.files_done = ctx.files_done;
    ctx.emit("", true);
    Ok(summary)
}

/// Pre-flight check: which sources would collide with existing destinations.
pub fn check_conflicts(sources: &[PathBuf], dest_dir: &Path) -> Vec<ConflictInfo> {
    sources
        .iter()
        .filter_map(|src| {
            let name = src.file_name()?;
            let dest = dest_dir.join(name);
            if fs::symlink_metadata(&dest).is_ok() {
                Some(ConflictInfo {
                    source: src.to_string_lossy().into_owned(),
                    dest: dest.to_string_lossy().into_owned(),
                    is_dir: src.is_dir(),
                })
            } else {
                None
            }
        })
        .collect()
}

/// Create a folder. Fails if it already exists (WinM semantics).
pub fn make_dir(path: &Path) -> Result<(), FsError> {
    fs::create_dir(path).map_err(|e| FsError::from_io(e, path))
}

/// Rename a file or folder within its directory.
pub fn rename_path(path: &Path, new_name: &str) -> Result<(), FsError> {
    if new_name.is_empty() || new_name.contains('/') || new_name.contains('\\') {
        return Err(FsError::internal("invalid new name"));
    }
    let parent = path.parent().ok_or_else(|| FsError::internal("no parent folder"))?;
    let dst = parent.join(new_name);
    fs::rename(path, &dst).map_err(|e| FsError::from_io(e, &dst))
}
