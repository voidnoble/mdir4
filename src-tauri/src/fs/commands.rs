use super::error::FsError;
use super::ops;
use super::registry::OpRegistry;
use super::scan;
use super::types::{ConflictInfo, DiskSpace, Entry, OpSummary, OverwritePolicy, ProgressPayload};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, State};

/// Final event: mirrors the last progress payload with `done: true`.
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
pub async fn fs_list(path: String) -> Result<Vec<Entry>, FsError> {
    tauri::async_runtime::spawn_blocking(move || scan::list_dir(Path::new(&path)))
        .await
        .map_err(|_| FsError::internal("list task panicked"))?
}

#[tauri::command(rename_all = "camelCase")]
pub async fn fs_copy(
    app: AppHandle,
    state: State<'_, OpRegistry>,
    sources: Vec<String>,
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
        let sources: Vec<PathBuf> = sources.iter().map(PathBuf::from).collect();
        ops::copy_items(&sources, Path::new(&dest_dir), policy, &oid, &cancel, &progress)
    })
    .await
    .map_err(|_| FsError::internal("copy task panicked"))?;
    state.unregister(&op_id);
    if let Ok(summary) = &result {
        emit_done(&app, summary);
    }
    result
}

#[tauri::command(rename_all = "camelCase")]
pub async fn fs_move(
    app: AppHandle,
    state: State<'_, OpRegistry>,
    sources: Vec<String>,
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
        let sources: Vec<PathBuf> = sources.iter().map(PathBuf::from).collect();
        ops::move_items(&sources, Path::new(&dest_dir), policy, &oid, &cancel, &progress)
    })
    .await
    .map_err(|_| FsError::internal("move task panicked"))?;
    state.unregister(&op_id);
    if let Ok(summary) = &result {
        emit_done(&app, summary);
    }
    result
}

#[tauri::command(rename_all = "camelCase")]
pub async fn fs_delete(
    app: AppHandle,
    state: State<'_, OpRegistry>,
    paths: Vec<String>,
    permanent: bool,
    op_id: String,
) -> Result<OpSummary, FsError> {
    let cancel = state.register(&op_id);
    let oid = op_id.clone();
    let app2 = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let progress = move |p: ProgressPayload| {
            let _ = app2.emit("mdir4://fs-progress", p);
        };
        let paths: Vec<PathBuf> = paths.iter().map(PathBuf::from).collect();
        ops::delete_items(&paths, permanent, &oid, &cancel, &progress)
    })
    .await
    .map_err(|_| FsError::internal("delete task panicked"))?;
    state.unregister(&op_id);
    if let Ok(summary) = &result {
        emit_done(&app, summary);
    }
    result
}

#[tauri::command(rename_all = "camelCase")]
pub async fn fs_make_dir(path: String) -> Result<(), FsError> {
    tauri::async_runtime::spawn_blocking(move || ops::make_dir(Path::new(&path)))
        .await
        .map_err(|_| FsError::internal("mkdir task panicked"))?
}

#[tauri::command(rename_all = "camelCase")]
pub async fn fs_rename(path: String, new_name: String) -> Result<(), FsError> {
    tauri::async_runtime::spawn_blocking(move || ops::rename_path(Path::new(&path), &new_name))
        .await
        .map_err(|_| FsError::internal("rename task panicked"))?
}

#[tauri::command(rename_all = "camelCase")]
pub async fn fs_cancel(state: State<'_, OpRegistry>, op_id: String) -> Result<bool, FsError> {
    Ok(state.cancel(&op_id))
}

#[tauri::command(rename_all = "camelCase")]
pub async fn fs_check_conflicts(
    sources: Vec<String>,
    dest_dir: String,
) -> Result<Vec<ConflictInfo>, FsError> {
    tauri::async_runtime::spawn_blocking(move || {
        let sources: Vec<PathBuf> = sources.iter().map(PathBuf::from).collect();
        ops::check_conflicts(&sources, Path::new(&dest_dir))
    })
    .await
    .map_err(|_| FsError::internal("conflict check task panicked"))
}

#[tauri::command(rename_all = "camelCase")]
pub async fn fs_home() -> Result<String, FsError> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| FsError::internal("cannot determine home directory"))
}

/// Free/total bytes of the volume containing `path`.
#[tauri::command(rename_all = "camelCase")]
pub async fn fs_disk_space(path: String) -> Result<DiskSpace, FsError> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = Path::new(&path);
        let free = fs2::available_space(p).map_err(|e| FsError::from_io(e, p))?;
        let total = fs2::total_space(p).map_err(|e| FsError::from_io(e, p))?;
        Ok(DiskSpace { free, total })
    })
    .await
    .map_err(|_| FsError::internal("disk space task panicked"))?
}
