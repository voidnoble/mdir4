//! P1 headless tests for the fs core: scan, copy, move, delete, mkdir, rename.

use mdir4::fs::ops;
use mdir4::fs::scan;
use mdir4::fs::types::{OverwritePolicy, ProgressPayload};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::Mutex;
use tempfile::TempDir;

fn no_cancel() -> AtomicBool {
    AtomicBool::new(false)
}

fn recorder() -> (
    std::sync::Arc<Mutex<Vec<ProgressPayload>>>,
    impl Fn(ProgressPayload),
) {
    let events = std::sync::Arc::new(Mutex::new(Vec::new()));
    let sink = events.clone();
    let progress = move |p: ProgressPayload| {
        sink.lock().unwrap().push(p);
    };
    (events, progress)
}

/// Build: root/{a.txt, b.txt, sub/c.txt}
fn make_tree(root: &Path) -> Vec<PathBuf> {
    fs::create_dir_all(root.join("sub")).unwrap();
    for rel in ["a.txt", "b.txt", "sub/c.txt"] {
        fs::write(root.join(rel), format!("contents of {}", rel)).unwrap();
    }
    vec![root.join("a.txt"), root.join("b.txt"), root.join("sub")]
}

#[test]
fn list_dir_sorts_dirs_first_then_name() {
    let tmp = TempDir::new().unwrap();
    fs::write(tmp.path().join("b.txt"), "b").unwrap();
    fs::write(tmp.path().join("a.txt"), "a").unwrap();
    fs::create_dir(tmp.path().join("zzz")).unwrap();
    fs::write(tmp.path().join(".hidden"), "h").unwrap();

    let entries = scan::list_dir(tmp.path()).unwrap();
    let names: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();
    assert_eq!(names, ["zzz", ".hidden", "a.txt", "b.txt"]);

    let dir = entries.iter().find(|e| e.name == "zzz").unwrap();
    assert!(dir.is_dir);
    let file = entries.iter().find(|e| e.name == "a.txt").unwrap();
    assert!(!file.is_dir && file.size == 1);
    let hidden = entries.iter().find(|e| e.name == ".hidden").unwrap();
    assert!(hidden.hidden);
}

#[test]
fn list_dir_missing_path_errors() {
    let err = scan::list_dir(Path::new("/definitely/not/here-xyz")).unwrap_err();
    assert_eq!(err.kind, "notFound");
}

#[test]
fn copy_tree_reports_progress() {
    let tmp = TempDir::new().unwrap();
    let src = tmp.path().join("src");
    let dst = tmp.path().join("dst");
    fs::create_dir(&dst).unwrap();
    make_tree(&src);

    let cancel = no_cancel();
    let (events, progress) = recorder();
    let summary = ops::copy_items(
        &[src.join("a.txt"), src.join("sub")],
        &dst,
        OverwritePolicy::Overwrite,
        "op-1",
        &cancel,
        &progress,
    )
    .unwrap();

    assert_eq!(summary.files_total, 2); // a.txt + sub/c.txt
    assert_eq!(summary.files_done, 2);
    assert!(!summary.cancelled);
    assert!(summary.errors.is_empty());
    assert_eq!(
        fs::read_to_string(dst.join("a.txt")).unwrap(),
        "contents of a.txt"
    );
    assert_eq!(
        fs::read_to_string(dst.join("sub").join("c.txt")).unwrap(),
        "contents of sub/c.txt"
    );
    assert!(events.lock().unwrap().len() >= 2);
}

#[test]
fn copy_conflict_rename_and_skip() {
    let tmp = TempDir::new().unwrap();
    let src = tmp.path().join("src");
    let dst = tmp.path().join("dst");
    fs::create_dir_all(&src).unwrap();
    fs::create_dir_all(&dst).unwrap();
    fs::write(src.join("a.txt"), "new").unwrap();
    fs::write(dst.join("a.txt"), "old").unwrap();

    let cancel = no_cancel();
    let (_events, progress) = recorder();
    let summary = ops::copy_items(
        &[src.join("a.txt")],
        &dst,
        OverwritePolicy::Rename,
        "op-2",
        &cancel,
        &progress,
    )
    .unwrap();
    assert!(summary.errors.is_empty());
    assert_eq!(fs::read_to_string(dst.join("a.txt")).unwrap(), "old");
    assert_eq!(fs::read_to_string(dst.join("a (2).txt")).unwrap(), "new");

    let summary = ops::copy_items(
        &[src.join("a.txt")],
        &dst,
        OverwritePolicy::Skip,
        "op-3",
        &cancel,
        &|_: ProgressPayload| {},
    )
    .unwrap();
    assert_eq!(summary.skipped.len(), 1);
    // skip leaves the destination untouched
    assert_eq!(fs::read_to_string(dst.join("a.txt")).unwrap(), "old");
    assert_eq!(fs::read_to_string(dst.join("a.txt")).unwrap(), "old");
}

#[test]
fn move_fast_path_renames() {
    let tmp = TempDir::new().unwrap();
    let src = tmp.path().join("src");
    let dst = tmp.path().join("dst");
    fs::create_dir_all(&src).unwrap();
    fs::create_dir_all(&dst).unwrap();
    fs::write(src.join("m.txt"), "move me").unwrap();

    let cancel = no_cancel();
    let summary = ops::move_items(
        &[src.join("m.txt")],
        &dst,
        OverwritePolicy::Overwrite,
        "op-4",
        &cancel,
        &|_: ProgressPayload| {},
    )
    .unwrap();

    assert!(summary.errors.is_empty());
    assert!(!src.join("m.txt").exists());
    assert_eq!(fs::read_to_string(dst.join("m.txt")).unwrap(), "move me");
    assert_eq!(summary.files_done, 1);
}

#[test]
fn delete_permanent_removes_tree() {
    let tmp = TempDir::new().unwrap();
    let target = tmp.path().join("gone");
    make_tree(&target);

    let cancel = no_cancel();
    let (events, progress) = recorder();
    let summary = ops::delete_items(&[target.clone()], true, "op-5", &cancel, &progress).unwrap();

    assert!(!target.exists());
    assert!(summary.errors.is_empty());
    assert_eq!(summary.files_done, 3); // a.txt, b.txt, sub/c.txt
    assert!(!events.lock().unwrap().is_empty());
}

#[test]
fn delete_to_trash() {
    let tmp = TempDir::new().unwrap();
    let target = tmp.path().join("trashed.txt");
    fs::write(&target, "bye").unwrap();

    let cancel = no_cancel();
    let summary = ops::delete_items(
        &[target.clone()],
        false,
        "op-6",
        &cancel,
        &|_: ProgressPayload| {},
    )
    .unwrap();

    assert!(
        summary.errors.is_empty(),
        "trash errors: {:?}",
        summary.errors
    );
    assert!(!target.exists());
}

#[test]
fn cancelled_copy_stops_early() {
    let tmp = TempDir::new().unwrap();
    let src = tmp.path().join("src");
    let dst = tmp.path().join("dst");
    fs::create_dir_all(&dst).unwrap();
    fs::create_dir_all(&src).unwrap();
    for i in 0..50 {
        fs::write(src.join(format!("f{}.txt", i)), "x".repeat(1000)).unwrap();
    }

    let cancel = AtomicBool::new(true); // cancelled before start
    let summary = ops::copy_items(
        &[src.clone()],
        &dst,
        OverwritePolicy::Overwrite,
        "op-7",
        &cancel,
        &|_: ProgressPayload| {},
    )
    .unwrap();

    assert!(summary.cancelled);
}

#[test]
fn make_dir_and_rename() {
    let tmp = TempDir::new().unwrap();
    let new_dir = tmp.path().join("newfolder");
    ops::make_dir(&new_dir).unwrap();
    assert!(new_dir.is_dir());

    let err = ops::make_dir(&new_dir).unwrap_err();
    assert_eq!(err.kind, "alreadyExists");

    let file = tmp.path().join("old.txt");
    fs::write(&file, "data").unwrap();
    ops::rename_path(&file, "new.txt").unwrap();
    assert!(!file.exists());
    assert_eq!(
        fs::read_to_string(tmp.path().join("new.txt")).unwrap(),
        "data"
    );

    assert!(ops::rename_path(tmp.path().join("new.txt").as_path(), "bad/name").is_err());
}

#[test]
#[cfg(unix)]
fn copy_preserves_symlink() {
    use std::os::unix::fs::symlink;
    let tmp = TempDir::new().unwrap();
    let src = tmp.path().join("src");
    let dst = tmp.path().join("dst");
    fs::create_dir_all(&src).unwrap();
    fs::create_dir_all(&dst).unwrap();
    fs::write(src.join("real.txt"), "real").unwrap();
    symlink("real.txt", src.join("link.txt")).unwrap();

    let cancel = no_cancel();
    let summary = ops::copy_items(
        &[src.join("link.txt")],
        &dst,
        OverwritePolicy::Overwrite,
        "op-8",
        &cancel,
        &|_: ProgressPayload| {},
    )
    .unwrap();

    assert!(summary.errors.is_empty());
    let meta = fs::symlink_metadata(dst.join("link.txt")).unwrap();
    assert!(meta.file_type().is_symlink());
}

#[test]
fn check_conflicts_lists_existing_dests() {
    let tmp = TempDir::new().unwrap();
    let src = tmp.path().join("src");
    let dst = tmp.path().join("dst");
    fs::create_dir_all(&src).unwrap();
    fs::create_dir_all(&dst).unwrap();
    fs::write(src.join("a.txt"), "new").unwrap();
    fs::write(src.join("b.txt"), "new").unwrap();
    fs::write(dst.join("a.txt"), "old").unwrap();

    let conflicts = ops::check_conflicts(&[src.join("a.txt"), src.join("b.txt")], &dst);
    assert_eq!(conflicts.len(), 1);
    assert!(conflicts[0].dest.ends_with("a.txt"));
    assert!(!conflicts[0].is_dir);
}

#[test]
fn zip_roundtrip() {
    use mdir4::archive;
    use std::sync::atomic::AtomicBool;

    let tmp = TempDir::new().unwrap();
    let src = tmp.path().join("src");
    fs::create_dir_all(src.join("sub")).unwrap();
    fs::write(src.join("a.txt"), "hello zip").unwrap();
    fs::write(src.join("sub").join("b.txt"), "nested").unwrap();

    let zip_path = tmp.path().join("out.zip");
    let cancel = AtomicBool::new(false);
    let noop = |_: mdir4::fs::types::ProgressPayload| {};
    let summary =
        archive::zip_create(&[src.clone()], &zip_path, "test-zip", &cancel, &noop).unwrap();
    assert_eq!(summary.files_done, 2);
    assert!(zip_path.exists());

    let entries = archive::zip_list(&zip_path).unwrap();
    assert_eq!(entries.len(), 3); // sub/ dir + 2 files
    assert!(entries.iter().any(|e| e.name.ends_with("a.txt")));
    assert!(entries.iter().any(|e| e.is_dir));

    let dest = tmp.path().join("out");
    let summary = archive::zip_extract(
        &zip_path,
        &dest,
        mdir4::fs::types::OverwritePolicy::Overwrite,
        "test-unzip",
        &cancel,
        &noop,
    )
    .unwrap();
    assert_eq!(summary.files_done, 3); // includes the sub/ dir entry
    let content = fs::read_to_string(dest.join("src").join("a.txt")).unwrap();
    assert_eq!(content, "hello zip");
    let nested = fs::read_to_string(dest.join("src").join("sub").join("b.txt")).unwrap();
    assert_eq!(nested, "nested");
}
