//! File-system service (P1).
//!
//! - [`scan`] — directory listing
//! - [`ops`] — copy / move / delete / mkdir / rename with progress + cancel
//! - [`commands`] — Tauri command wrappers
//! - [`registry`] — cancellation tokens per operation id

pub mod commands;
pub mod error;
pub mod ops;
pub mod registry;
pub mod scan;
pub mod types;
