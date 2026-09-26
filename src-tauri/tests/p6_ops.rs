//! P6 integration tests: dir size, file props, descript.ion, write_text, exec.
use mdir4::props;
use std::fs;
use std::path::PathBuf;
use tempfile::tempdir;

fn fixture() -> (tempfile::TempDir, PathBuf) {
    let td = tempdir().unwrap();
    let root = td.path().to_path_buf();
    fs::create_dir_all(root.join("sub")).unwrap();
    fs::write(root.join("a.txt"), b"hello").unwrap(); // 5 bytes
    fs::write(root.join("sub").join("b.bin"), b"0123456789").unwrap(); // 10 bytes
    fs::write(root.join("sp ace.txt"), b"xyz").unwrap(); // 3 bytes
    (td, root)
}

#[test]
fn dir_size_counts_recursively() {
    let (_td, root) = fixture();
    let s = props::dir_size(&root).unwrap();
    assert_eq!(s.files, 3);
    assert_eq!(s.dirs, 1);
    assert_eq!(s.bytes, 18);
}

#[test]
fn dir_size_single_file() {
    let (_td, root) = fixture();
    let s = props::dir_size(&root.join("a.txt")).unwrap();
    assert_eq!(s.files, 1);
    assert_eq!(s.bytes, 5);
}

#[test]
fn props_and_readonly_and_mtime() {
    let (_td, root) = fixture();
    let p = root.join("a.txt");
    let pr = props::file_props(&p).unwrap();
    assert!(!pr.is_dir);
    assert_eq!(pr.size, 5);
    assert!(!pr.readonly);

    props::set_readonly(&p, true).unwrap();
    assert!(props::file_props(&p).unwrap().readonly);
    props::set_readonly(&p, false).unwrap();
    assert!(!props::file_props(&p).unwrap().readonly);

    props::set_mtime(&p, 1_000_000_000).unwrap();
    assert_eq!(props::file_props(&p).unwrap().modified, 1_000_000_000);
}

#[test]
fn descript_ion_roundtrip() {
    let (_td, root) = fixture();
    assert_eq!(props::desc_get(&root, "a.txt").unwrap(), None);

    props::desc_set(&root, "a.txt", "plain text file").unwrap();
    assert_eq!(
        props::desc_get(&root, "a.txt").unwrap().as_deref(),
        Some("plain text file")
    );

    // name with a space must be quoted in the file
    props::desc_set(&root, "sp ace.txt", "has space").unwrap();
    let ion = fs::read_to_string(root.join("descript.ion")).unwrap();
    assert!(ion.contains("\"sp ace.txt\" has space"));

    // clearing removes the entry
    props::desc_set(&root, "a.txt", "   ").unwrap();
    assert_eq!(props::desc_get(&root, "a.txt").unwrap(), None);
    assert_eq!(
        props::desc_get(&root, "sp ace.txt").unwrap().as_deref(),
        Some("has space")
    );
}

#[test]
fn write_text_creates_parents() {
    let (_td, root) = fixture();
    let target = root.join("new").join("deep").join("out.txt");
    props::write_text(&target, "hello äöü").unwrap();
    assert_eq!(fs::read_to_string(&target).unwrap(), "hello äöü");
}

#[cfg(unix)]
#[test]
fn exec_captures_output() {
    let r = props::run_exec("/bin/echo", &["hi".to_string()], "/tmp").unwrap();
    assert_eq!(r.code, 0);
    assert!(r.stdout.contains("hi"));
}

#[cfg(unix)]
#[test]
fn exec_bad_program_errors() {
    assert!(props::run_exec("/nonexistent-prog-xyz", &[], "/tmp").is_err());
}
