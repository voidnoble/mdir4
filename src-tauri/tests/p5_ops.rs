//! P5 integration tests: split/combine round-trip (with CRC) and directory tree.

use mdir4::split::{combine_files, split_file};
use mdir4::tree::{roots, tree_children};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;

fn tmp(name: &str) -> PathBuf {
    let p = std::env::temp_dir().join(format!("mdir4_p5_{name}"));
    let _ = fs::remove_dir_all(&p);
    fs::create_dir_all(&p).unwrap();
    p
}

fn no_progress(_: mdir4::fs::types::ProgressPayload) {}

#[test]
fn split_combine_roundtrip() {
    let dir = tmp("roundtrip");
    // 2.5 MiB deterministic content
    let data: Vec<u8> = (0..2_621_440u32).map(|i| (i % 251) as u8).collect();
    let src = dir.join("payload.bin");
    fs::write(&src, &data).unwrap();

    let cancel = AtomicBool::new(false);
    let parts = split_file(&src, &dir, 1_048_576, "op1", &cancel, &no_progress).unwrap();
    assert_eq!(parts.len(), 3);
    assert!(dir.join("payload.bin.crc").exists());

    // remove original, combine into new file
    fs::remove_file(&src).unwrap();
    let out = dir.join("restored.bin");
    combine_files(&parts[0], &out, "op2", &cancel, &no_progress).unwrap();
    assert_eq!(fs::read(&out).unwrap(), data);
}

#[test]
fn combine_detects_crc_mismatch() {
    let dir = tmp("crc");
    let data: Vec<u8> = (0..100_000u32).map(|i| (i % 251) as u8).collect();
    let src = dir.join("a.bin");
    fs::write(&src, &data).unwrap();

    let cancel = AtomicBool::new(false);
    let parts = split_file(&src, &dir, 40_000, "op1", &cancel, &no_progress).unwrap();
    assert_eq!(parts.len(), 3);

    // corrupt middle part
    let mut bad = fs::read(&parts[1]).unwrap();
    bad[10] ^= 0xFF;
    fs::write(&parts[1], &bad).unwrap();

    let err = combine_files(&parts[0], &dir.join("bad.bin"), "op2", &cancel, &no_progress)
        .expect_err("expected CRC mismatch");
    assert!(err.message.contains("CRC"), "unexpected: {}", err.message);
}

#[test]
fn split_rejects_non_file() {
    let dir = tmp("nonfile");
    let cancel = AtomicBool::new(false);
    let err = split_file(&dir, &dir, 1024, "op1", &cancel, &no_progress).expect_err("dir split");
    assert!(!err.message.is_empty());
}

#[test]
fn tree_children_and_roots() {
    let dir = tmp("tree");
    fs::create_dir(dir.join("alpha")).unwrap();
    fs::create_dir(dir.join("Beta")).unwrap();
    fs::create_dir(dir.join(".hidden")).unwrap();
    fs::write(dir.join("file.txt"), b"x").unwrap();

    let kids = tree_children(&dir).unwrap();
    let names: Vec<_> = kids.iter().map(|n| n.name.as_str()).collect();
    assert_eq!(names, vec!["alpha", "Beta"]);
    assert!(kids.iter().all(|n| !n.has_children));

    fs::create_dir(dir.join("alpha").join("nested")).unwrap();
    let kids = tree_children(&dir).unwrap();
    assert!(kids.iter().find(|n| n.name == "alpha").unwrap().has_children);

    assert!(!roots().is_empty());
}
