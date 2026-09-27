use serde::{Deserialize, Serialize};

/// One directory entry returned by `fs_list`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_symlink: bool,
    pub size: u64,
    /// Last-modified time as unix millis, if available.
    pub modified_ms: Option<i64>,
    pub readonly: bool,
    pub hidden: bool,
}

/// Disk space of the volume containing `path`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskSpace {
    pub free: u64,
    pub total: u64,
}

/// What to do when the target already exists (copy / move).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum OverwritePolicy {
    #[default]
    Overwrite,
    Skip,
    Rename,
    Newer,
}

/// Progress event payload, emitted as `mdir4://fs-progress`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressPayload {
    pub op_id: String,
    /// "copy" | "move" | "delete"
    pub op: String,
    pub current_file: String,
    pub files_done: usize,
    pub files_total: usize,
    pub bytes_done: u64,
    pub bytes_total: u64,
    pub done: bool,
}

/// Callback invoked with progress updates. Must be cheap; it is called
/// per file and per 8 MiB chunk.
pub type ProgressFn = dyn Fn(ProgressPayload) + Send + Sync;

/// Summary returned when an operation finishes.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpSummary {
    pub op_id: String,
    pub op: String,
    pub files_done: usize,
    pub files_total: usize,
    pub bytes_done: u64,
    pub bytes_total: u64,
    pub skipped: Vec<String>,
    pub errors: Vec<String>,
    pub cancelled: bool,
}

/// A destination that already exists (copy / move pre-flight check).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictInfo {
    pub source: String,
    pub dest: String,
    pub is_dir: bool,
}
