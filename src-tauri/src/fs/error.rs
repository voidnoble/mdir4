use serde::Serialize;
use std::io;
use std::path::Path;

/// Serializable file-system error for the frontend.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsError {
    /// "notFound" | "permission" | "alreadyExists" | "cancelled" | "internal" | "io"
    pub kind: String,
    pub path: Option<String>,
    pub message: String,
}

impl FsError {
    pub fn from_io(err: io::Error, path: &Path) -> Self {
        let kind = match err.kind() {
            io::ErrorKind::NotFound => "notFound",
            io::ErrorKind::PermissionDenied => "permission",
            io::ErrorKind::AlreadyExists => "alreadyExists",
            _ => "io",
        };
        Self {
            kind: kind.to_string(),
            path: Some(path.to_string_lossy().into_owned()),
            message: err.to_string(),
        }
    }

    pub fn cancelled() -> Self {
        Self {
            kind: "cancelled".to_string(),
            path: None,
            message: "operation cancelled".to_string(),
        }
    }

    pub fn internal(msg: impl Into<String>) -> Self {
        Self {
            kind: "internal".to_string(),
            path: None,
            message: msg.into(),
        }
    }
}

impl From<FsError> for String {
    fn from(e: FsError) -> String {
        serde_json::to_string(&e).unwrap_or_else(|_| e.message.clone())
    }
}
