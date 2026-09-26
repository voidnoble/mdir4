use super::error::FsError;
use super::types::Entry;
use rayon::prelude::*;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

/// List a directory. Directories first, then case-insensitive name order.
/// Hidden files are included; the frontend applies the "show hidden" filter.
pub fn list_dir(path: &Path) -> Result<Vec<Entry>, FsError> {
    let read = fs::read_dir(path).map_err(|e| FsError::from_io(e, path))?;
    let dents: Vec<_> = read
        .collect::<Result<_, _>>()
        .map_err(|e| FsError::from_io(e, path))?;

    let mut entries: Vec<Entry> = dents
        .par_iter()
        .filter_map(|de| entry_from(de).ok())
        .collect();

    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
            .then_with(|| a.name.cmp(&b.name))
    });
    Ok(entries)
}

fn entry_from(de: &fs::DirEntry) -> Result<Entry, FsError> {
    let path = de.path();
    let ft = de.file_type().map_err(|e| FsError::from_io(e, &path))?;
    let is_symlink = ft.is_symlink();

    // For symlinks, report the target's metadata when resolvable.
    let md = if is_symlink {
        fs::metadata(&path).ok()
    } else {
        de.metadata().ok()
    };

    let name = de
        .file_name()
        .to_string_lossy()
        .into_owned();

    let (is_dir, size, modified_ms, readonly) = match md {
        Some(m) => (
            m.is_dir(),
            if m.is_dir() { 0 } else { m.len() },
            m.modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as i64),
            m.permissions().readonly(),
        ),
        None => (false, 0, None, false),
    };

    Ok(Entry {
        hidden: is_hidden(&name),
        name,
        path: path.to_string_lossy().into_owned(),
        is_dir,
        is_symlink,
        size,
        modified_ms,
        readonly,
    })
}

fn is_hidden(name: &str) -> bool {
    // Unix dotfile rule. Windows hidden-attribute detection lands in P2
    // (requires windows-metadata).
    name.starts_with('.')
}
