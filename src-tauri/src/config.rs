//! App settings persisted as JSON in the Tauri app-data dir.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// A QCD (quick-change-directory) favorite.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QcdEntry {
    pub name: String,
    pub path: String,
    #[serde(default)]
    pub hotkey: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtAssoc {
    /// e.g. ".txt" (with dot, lowercase)
    pub ext: String,
    /// program path; empty = system default
    pub program: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    /// "dark" | "light" | "custom"
    pub theme: String,
    /// CSS variable overrides from a .col file (theme == "custom")
    #[serde(default)]
    pub custom_theme_css: Option<HashMap<String, String>>,
    /// extension -> color from a .col file
    #[serde(default)]
    pub custom_ext_colors: Option<HashMap<String, String>>,
    pub custom_theme_name: Option<String>,
    /// "ko" | "en" | "custom"
    pub lang: String,
    /// Mdir4 i18n dict from a .lng file (lang == "custom")
    #[serde(default)]
    pub custom_lang: Option<HashMap<String, String>>,
    pub custom_lang_name: Option<String>,
    pub show_hidden: bool,
    pub use_trash: bool,
    pub confirm_delete: bool,
    #[serde(default)]
    pub qcd: Vec<QcdEntry>,
    pub left_path: Option<String>,
    pub right_path: Option<String>,
    /// file extension → program associations
    #[serde(default)]
    pub assoc: Vec<ExtAssoc>,
    /// external archiver commands (rar/7z …)
    #[serde(default)]
    pub ext_packer: String,
    #[serde(default)]
    pub ext_unpacker: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            custom_theme_css: None,
            custom_ext_colors: None,
            custom_theme_name: None,
            lang: "ko".to_string(),
            custom_lang: None,
            custom_lang_name: None,
            show_hidden: false,
            use_trash: true,
            confirm_delete: true,
            qcd: Vec::new(),
            left_path: None,
            right_path: None,
            assoc: Vec::new(),
            ext_packer: String::new(),
            ext_unpacker: String::new(),
        }
    }
}

fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("config.json"))
}

#[tauri::command]
pub async fn config_load(app: tauri::AppHandle) -> Result<AppConfig, String> {
    let path = config_path(&app)?;
    if !path.exists() {
        return Ok(AppConfig::default());
    }
    let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    // tolerate older/partial configs
    let mut cfg = AppConfig::default();
    if let Ok(partial) = serde_json::from_str::<serde_json::Value>(&text) {
        if let Ok(merged) = serde_json::from_value::<AppConfig>(merge(cfg_clone(&cfg), partial)) {
            cfg = merged;
        }
    }
    Ok(cfg)
}

fn cfg_clone(c: &AppConfig) -> serde_json::Value {
    serde_json::to_value(c).unwrap_or(serde_json::Value::Null)
}

fn merge(mut base: serde_json::Value, over: serde_json::Value) -> serde_json::Value {
    if let (Some(b), Some(o)) = (base.as_object_mut(), over.as_object()) {
        for (k, v) in o {
            b.insert(k.clone(), v.clone());
        }
    }
    base
}

#[tauri::command]
pub async fn config_save(app: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    let path = config_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&path, text).map_err(|e| e.to_string())
}
