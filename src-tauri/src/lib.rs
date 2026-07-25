mod commands;
pub mod core;

use tokio::sync::mpsc;

pub fn run() {
    // Initialize tracing
    let log_path = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("afo")
        .join("afo.log");

    if let Some(parent) = log_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let file_appender = tracing_appender::rolling::daily(
        log_path
            .parent()
            .unwrap_or_else(|| std::path::Path::new(".")),
        "afo.log",
    );

    tracing_subscriber::fmt()
        .with_writer(file_appender)
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .with_ansi(false)
        .init();

    tracing::info!("AFO v2.0 starting");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Initialize journal
            if let Err(e) = core::journal::init_journal() {
                tracing::error!(error = %e, "Failed to initialize journal");
            }

            // Initialize capture module (creates tables in journal.db)
            if let Err(e) = core::capture::init_capture() {
                tracing::error!(error = %e, "Failed to initialize capture");
            }

            // Initialize scheduler
            if let Err(e) = core::scheduler::init_scheduler() {
                tracing::error!(error = %e, "Failed to initialize scheduler");
            }

            // Start scheduler cron loop
            let app_handle_scheduler = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                core::scheduler::start_scheduler_loop(app_handle_scheduler).await;
            });

            // Initialize watcher with channel (increased from 100 to 1000 to prevent
            // event loss during bulk file operations like cp -r of 10k+ files)
            let (tx, mut rx) = mpsc::channel::<String>(1000);

            if let Err(e) = core::watcher::init_watcher(tx) {
                tracing::error!(error = %e, "Failed to initialize watcher");
            }

            // Spawn task to process file events
            // Use tauri::async_runtime::spawn — tokio::spawn panics here because
            // the Tauri setup hook runs before the Tokio reactor is available.
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                while let Some(path) = rx.recv().await {
                    let app_clone = app_handle.clone();
                    let path_clone = path.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = core::watcher::process_file_event(&path_clone, &app_clone).await {
                            tracing::error!(error = %e, path = %path_clone, "Failed to process file event");
                        }
                    });
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan_directory,
            commands::organize_by_extension,
            commands::organize_by_date,
            commands::batch_rename,
            commands::list_rules,
            commands::save_rules,
            commands::export_rules,
            commands::import_rules,
            commands::apply_rules,
            commands::scan_duplicates_cmd,
            commands::quarantine_duplicates_cmd,
            commands::delete_duplicates_cmd,
            commands::cleanup_quarantine_cmd,
            commands::get_history,
            commands::search_history,
            commands::undo_last,
            commands::undo_operation,
            commands::redo_last,
            commands::get_metadata,
            commands::watch_directory,
            commands::unwatch_directory,
            commands::list_watched_directories,
            commands::create_schedule_cmd,
            commands::list_schedules_cmd,
            commands::delete_schedule_cmd,
            commands::toggle_schedule_cmd,
            commands::run_schedule_now,
            commands::cloud_list_providers,
            commands::cloud_sync_now,
            commands::ml_suggest_category,
            // Capture commands
            commands::get_capture_config,
            commands::set_capture_mode_cmd,
            commands::set_scan_interval_cmd,
            commands::toggle_always_allow_cmd,
            commands::set_dir_enabled_cmd,
            commands::remove_directory_cmd,
            commands::search_file_index,
            commands::get_indexed_files_cmd,
            commands::scan_and_index_cmd,
            commands::get_file_history_cmd,
            commands::get_recent_changes_cmd,
            commands::get_pending_actions_cmd,
            commands::approve_pending_action_cmd,
            commands::reject_pending_action_cmd,
            commands::approve_all_pending_cmd,
            commands::reject_all_pending_cmd,
            commands::get_capture_stats_cmd,
            commands::get_dir_stats_cmd,
            commands::scan_storage_breakdown,
            commands::get_system_disks,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
