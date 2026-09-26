//! P6: file properties, descript.ion, dir size, shell open.
//!
//! - `fs_dir_size`: recursive file/dir/byte counts
//! - `fs_file_props` / `fs_set_readonly` / `fs_set_mtime`: attributes & dates
//! - `fs_desc_get` / `fs_desc_set`: descript.ion (4DOS style) descriptions
//! - `fs_shell_open`: open with default or user-specified program

use crate::fs::error::FsError;
use serde::Serialize;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

type FsResult<T> = Result<T, FsError>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirSize {
    pub files: u64,
    pub dirs: u64,
    pub bytes: u64,
}

pub fn dir_size(path: &Path) -> FsResult<DirSize> {
    let meta = fs::symlink_metadata(path).map_err(|e| FsError::from_io(e, path))?;
    if !meta.is_dir() {
        return Ok(DirSize {
            files: 1,
            dirs: 0,
            bytes: meta.len(),
        });
    }
    let mut out = DirSize {
        files: 0,
        dirs: 0,
        bytes: 0,
    };
    let mut stack = vec![path.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let rd = fs::read_dir(&dir).map_err(|e| FsError::from_io(e, &dir))?;
        for ent in rd {
            let ent = match ent {
                Ok(e) => e,
                Err(_) => continue,
            };
            let ft = match ent.file_type() {
                Ok(t) => t,
                Err(_) => continue,
            };
            if ft.is_dir() {
                out.dirs += 1;
                stack.push(ent.path());
            } else if ft.is_file() {
                out.files += 1;
                if let Ok(m) = ent.metadata() {
                    out.bytes += m.len();
                }
            }
            // symlinks and others: counted as files only when resolvable; skip otherwise
        }
    }
    Ok(out)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileProps {
    pub size: u64,
    pub is_dir: bool,
    pub readonly: bool,
    pub hidden: bool,
    pub modified: i64,
    pub accessed: Option<i64>,
    pub created: Option<i64>,
}

fn unix_secs(t: std::time::SystemTime) -> Option<i64> {
    t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs() as i64)
}

pub fn file_props(path: &Path) -> FsResult<FileProps> {
    let meta = fs::symlink_metadata(path).map_err(|e| FsError::from_io(e, path))?;
    let readonly = meta.permissions().readonly();
    let name = path
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let hidden = name.starts_with('.');
    Ok(FileProps {
        size: meta.len(),
        is_dir: meta.is_dir(),
        readonly,
        hidden,
        modified: meta.modified().ok().and_then(unix_secs).unwrap_or(0),
        accessed: meta.accessed().ok().and_then(unix_secs),
        created: meta.created().ok().and_then(unix_secs),
    })
}

pub fn set_readonly(path: &Path, readonly: bool) -> FsResult<()> {
    let meta = fs::symlink_metadata(path).map_err(|e| FsError::from_io(e, path))?;
    let mut perm = meta.permissions();
    perm.set_readonly(readonly);
    fs::set_permissions(path, perm).map_err(|e| FsError::from_io(e, path))
}

pub fn set_mtime(path: &Path, unix_secs: i64) -> FsResult<()> {
    let ft = filetime::FileTime::from_unix_time(unix_secs, 0);
    filetime::set_file_mtime(path, ft).map_err(|e| FsError::from_io(e, path))
}

/* ---------------- descript.ion ---------------- */

fn ion_path(dir: &Path) -> PathBuf {
    dir.join("descript.ion")
}

/// Parse descript.ion content into an ordered map (4DOS style).
/// Lines: `"long name.ext" description` or `name.ext description`.
fn parse_ion(text: &str) -> BTreeMap<String, String> {
    let mut map = BTreeMap::new();
    for line in text.lines() {
        let line = line.trim_end();
        if line.is_empty() {
            continue;
        }
        let (name, desc) = if let Some(rest) = line.strip_prefix('"') {
            match rest.find('"') {
                Some(i) => (&rest[..i], rest[i + 1..].trim_start().to_string()),
                None => continue,
            }
        } else {
            match line.find(|c: char| c == ' ' || c == '\t') {
                Some(i) => (&line[..i], line[i..].trim_start().to_string()),
                None => (line, String::new()),
            }
        };
        if !name.is_empty() {
            map.insert(name.to_string(), desc);
        }
    }
    map
}

fn render_ion(map: &BTreeMap<String, String>) -> String {
    let mut out = String::new();
    for (name, desc) in map {
        if desc.is_empty() {
            continue;
        }
        if name.contains([' ', '\t']) {
            out.push_str(&format!("\"{name}\" {desc}\n"));
        } else {
            out.push_str(&format!("{name} {desc}\n"));
        }
    }
    out
}

fn read_ion(dir: &Path) -> BTreeMap<String, String> {
    let p = ion_path(dir);
    match fs::read(&p) {
        Ok(bytes) => {
            // UTF-8 first, then EUC-KR-ish fallback via lossy conversion
            let text = String::from_utf8(bytes)
                .unwrap_or_else(|e| String::from_utf8_lossy(e.as_bytes()).into_owned());
            parse_ion(&text)
        }
        Err(_) => BTreeMap::new(),
    }
}

pub fn desc_get(dir: &Path, name: &str) -> FsResult<Option<String>> {
    if !dir.is_dir() {
        return Err(FsError::internal("not a directory"));
    }
    Ok(read_ion(dir).remove(name))
}

pub fn desc_set(dir: &Path, name: &str, desc: &str) -> FsResult<()> {
    if !dir.is_dir() {
        return Err(FsError::internal("not a directory"));
    }
    let mut map = read_ion(dir);
    let desc = desc.trim();
    if desc.is_empty() {
        map.remove(name);
    } else {
        map.insert(name.to_string(), desc.to_string());
    }
    let p = ion_path(dir);
    if map.values().all(|v| v.is_empty()) {
        let _ = fs::remove_file(&p);
        return Ok(());
    }
    // Hide descript.ion on Unix-likes by keeping the dotfile convention out;
    // WinM hides it via hidden attribute on Windows — out of scope here.
    fs::write(&p, render_ion(&map)).map_err(|e| FsError::from_io(e, &p))
}

/* ---------------- shell open ---------------- */

pub fn shell_open(path: &Path, program: Option<&str>) -> FsResult<()> {
    if let Some(prog) = program {
        let prog = prog.trim();
        if prog.is_empty() {
            return Err(FsError::internal("empty program"));
        }
        std::process::Command::new(prog)
            .arg(path)
            .spawn()
            .map_err(|e| FsError::from_io(e, Path::new(prog)))?;
        return Ok(());
    }
    open::that(path).map_err(|e| FsError::internal(format!("open failed: {e}")))
}

/* ---------------- tauri commands ---------------- */

#[tauri::command(rename_all = "camelCase")]
pub fn fs_dir_size(path: String) -> Result<DirSize, FsError> {
    dir_size(Path::new(&path))
}

#[tauri::command(rename_all = "camelCase")]
pub fn fs_file_props(path: String) -> Result<FileProps, FsError> {
    file_props(Path::new(&path))
}

#[tauri::command(rename_all = "camelCase")]
pub fn fs_set_readonly(path: String, readonly: bool) -> Result<(), FsError> {
    set_readonly(Path::new(&path), readonly)
}

#[tauri::command(rename_all = "camelCase")]
pub fn fs_set_mtime(path: String, unix_secs: i64) -> Result<(), FsError> {
    set_mtime(Path::new(&path), unix_secs)
}

#[tauri::command(rename_all = "camelCase")]
pub fn fs_desc_get(dir: String, name: String) -> Result<Option<String>, FsError> {
    desc_get(Path::new(&dir), &name)
}

#[tauri::command(rename_all = "camelCase")]
pub fn fs_desc_set(dir: String, name: String, desc: String) -> Result<(), FsError> {
    desc_set(Path::new(&dir), &name, &desc)
}

#[tauri::command(rename_all = "camelCase")]
pub fn fs_shell_open(path: String, program: Option<String>) -> Result<(), FsError> {
    shell_open(Path::new(&path), program.as_deref())
}

pub fn write_text(path: &Path, text: &str) -> FsResult<()> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| FsError::from_io(e, parent))?;
        }
    }
    fs::write(path, text).map_err(|e| FsError::from_io(e, path))
}

#[tauri::command(rename_all = "camelCase")]
pub fn fs_write_text(path: String, text: String) -> Result<(), FsError> {
    write_text(Path::new(&path), &text)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecResult {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

/// Run an external program (archiver etc.) synchronously, capturing output.
pub fn run_exec(program: &str, args: &[String], cwd: &str) -> FsResult<ExecResult> {
    let prog = program.trim();
    if prog.is_empty() {
        return Err(FsError::internal("empty program"));
    }
    let mut cmd = std::process::Command::new(prog);
    cmd.args(args);
    if !cwd.trim().is_empty() {
        cmd.current_dir(cwd);
    }
    let out = cmd.output().map_err(|e| FsError::from_io(e, Path::new(prog)))?;
    Ok(ExecResult {
        code: out.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&out.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
    })
}

#[tauri::command(rename_all = "camelCase")]
pub fn fs_exec(program: String, args: Vec<String>, cwd: String) -> Result<ExecResult, FsError> {
    run_exec(&program, &args, &cwd)
}
