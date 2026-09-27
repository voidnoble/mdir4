/// Mdir4 core library entry point.
///
/// `fs` — file-system service: directory scan, copy / move / delete with
/// progress events, mkdir / rename. P1 scope. Later: `archive`, `search`,
/// `config`, `split`, `rename`, `hotkey`.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| Ok(()))
        .manage(fs::registry::OpRegistry::default())
        .invoke_handler(tauri::generate_handler![
            fs::commands::fs_list,
            fs::commands::fs_copy,
            fs::commands::fs_move,
            fs::commands::fs_delete,
            fs::commands::fs_make_dir,
            fs::commands::fs_rename,
            fs::commands::fs_cancel,
            fs::commands::fs_check_conflicts,
            fs::commands::fs_home,
            fs::commands::fs_disk_space,
            archive::fs_zip_list,
            archive::fs_zip_create,
            archive::fs_zip_extract,
            config::config_load,
            config::config_save,
            tree::fs_roots,
            tree::fs_tree_children,
            split::fs_split,
            split::fs_combine,
            props::fs_dir_size,
            props::fs_file_props,
            props::fs_set_readonly,
            props::fs_set_mtime,
            props::fs_desc_get,
            props::fs_desc_set,
            props::fs_shell_open,
            props::fs_write_text,
            props::fs_exec,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

pub mod fs;
pub mod archive;
pub mod config;
pub mod tree;
pub mod split;
pub mod props;
