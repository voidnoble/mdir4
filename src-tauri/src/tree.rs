//! Directory tree for MCD (WinM TMcdDialog equivalent).
//! Children are loaded lazily, one level at a time.

use crate::fs::error::FsError;
use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TreeNode {
    pub path: String,
    pub name: String,
    pub has_children: bool,
}

fn has_subdir(path: &Path) -> bool {
    let Ok(rd) = fs::read_dir(path) else {
        return false;
    };
    rd.into_iter().flatten().any(|e| {
        e.file_type().map(|t| t.is_dir()).unwrap_or(false)
            && !e.file_name().to_string_lossy().starts_with('.')
    })
}

/// Immediate subdirectories of `path` (hidden dot-dirs skipped).
pub fn tree_children(path: &Path) -> Result<Vec<TreeNode>, FsError> {
    let rd = fs::read_dir(path).map_err(|e| FsError::from_io(e, path))?;
    let mut nodes: Vec<TreeNode> = rd
        .into_iter()
        .flatten()
        .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
        .filter(|e| !e.file_name().to_string_lossy().starts_with('.'))
        .map(|e| {
            let p = e.path();
            TreeNode {
                name: e.file_name().to_string_lossy().into_owned(),
                has_children: has_subdir(&p),
                path: p.to_string_lossy().into_owned(),
            }
        })
        .collect();
    nodes.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(nodes)
}

/// Filesystem roots: drive letters on Windows, `/` elsewhere.
pub fn roots() -> Vec<TreeNode> {
    #[cfg(windows)]
    {
        let mut out = Vec::new();
        for c in b'A'..=b'Z' {
            let p = format!("{}:/", c as char);
            if Path::new(&p).exists() {
                out.push(TreeNode {
                    path: p.clone(),
                    name: p.trim_end_matches('/').to_string(),
                    has_children: true,
                });
            }
        }
        out
    }
    #[cfg(not(windows))]
    {
        vec![TreeNode {
            path: "/".to_string(),
            name: "/".to_string(),
            has_children: true,
        }]
    }
}

#[tauri::command(rename_all = "camelCase")]
pub async fn fs_tree_children(path: String) -> Result<Vec<TreeNode>, FsError> {
    tauri::async_runtime::spawn_blocking(move || tree_children(Path::new(&path)))
        .await
        .map_err(|_| FsError::internal("tree task panicked"))?
}

#[tauri::command]
pub async fn fs_roots() -> Result<Vec<TreeNode>, FsError> {
    Ok(roots())
}
