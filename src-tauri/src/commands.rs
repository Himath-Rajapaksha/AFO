use crate::core::capture;
use crate::core::cloud_sync;
use crate::core::disks;
use crate::core::duplicates;
use crate::core::journal;
use crate::core::metadata;
use crate::core::organizer;
use crate::core::rule_engine;
use crate::core::scheduler;
use crate::core::watcher;
use std::io;
use tauri::Emitter;
use tracing::{info, instrument, warn};

/// Check if an IO error is permission denied
fn is_permission_denied(err: &io::Error) -> bool {
    err.kind() == io::ErrorKind::PermissionDenied
}

/// Attempt a file move with one retry after a short delay (helps with Windows file locks)
/// Uses tokio::time::sleep to avoid blocking the Tokio runtime thread during retry.
async fn retry_move(src: &std::path::Path, dst: &std::path::Path) -> io::Result<()> {
    match std::fs::rename(src, dst) {
        Ok(()) => Ok(()),
        Err(e) if is_permission_denied(&e) => {
            // Retry once after a short delay — helps with Windows file locks
            // Use tokio::time::sleep instead of std::thread::sleep to avoid
            // blocking the Tokio runtime thread during the backoff.
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            std::fs::rename(src, dst)
        }
        Err(e) => Err(e),
    }
}

#[derive(Clone, serde::Serialize)]
pub struct ProgressEvent {
    pub current: usize,
    pub total: usize,
    pub file: String,
    pub status: String,
}

#[tauri::command]
#[instrument(skip(path), fields(path = %path))]
pub async fn scan_directory(path: String) -> Result<Vec<organizer::FileInfo>, String> {
    info!("Scanning directory");
    organizer::scan_directory(&path).map_err(|e| e.to_string())
}

#[tauri::command]
#[instrument(skip(app), fields(path = %path, dry_run))]
pub async fn organize_by_extension(
    app: tauri::AppHandle,
    path: String,
    dry_run: bool,
) -> Result<organizer::OrganizeResult, String> {
    info!("Organizing by extension");
    let files = organizer::scan_directory(&path).map_err(|e| e.to_string())?;
    let config = organizer::CategoryConfig::load();
    let mut result = organizer::OrganizeResult {
        total_files: files.len(),
        moved: 0,
        skipped: 0,
        errors: Vec::new(),
        dry_run,
    };

    for (i, file) in files.iter().enumerate() {
        if file.is_dir {
            result.skipped += 1;
            continue;
        }

        let category = config.categorize(&file.extension);
        let target_dir = std::path::Path::new(&path).join(category);

        if dry_run {
            result.moved += 1;
        } else {
            if !target_dir.exists() {
                std::fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
            }
            let target_file = organizer::unique_path(&target_dir.join(&file.name));
            match retry_move(std::path::Path::new(&file.path), &target_file).await {
                Ok(()) => {
                    result.moved += 1;
                    let _ = journal::record_file_operation(
                        "move",
                        &file.path,
                        &target_file.to_string_lossy(),
                    );
                }
                Err(e) => {
                    if is_permission_denied(&e) {
                        warn!(error = %e, file = %file.name, "Permission denied moving file");
                        result.errors.push(format!(
                            "Permission denied: {} (try running as administrator)",
                            file.name
                        ));
                    } else {
                        warn!(error = %e, file = %file.name, "Failed to move file");
                        result
                            .errors
                            .push(format!("Failed to move {}: {}", file.name, e));
                    }
                }
            }
        }

        let _ = app.emit(
            "afo://progress",
            ProgressEvent {
                current: i + 1,
                total: files.len(),
                file: file.name.clone(),
                status: if dry_run {
                    "preview".to_string()
                } else {
                    "moved".to_string()
                },
            },
        );
    }

    info!(
        moved = result.moved,
        skipped = result.skipped,
        "Organize complete"
    );
    Ok(result)
}

#[tauri::command]
#[instrument(skip(app), fields(path = %path, dry_run, date_format))]
pub async fn organize_by_date(
    app: tauri::AppHandle,
    path: String,
    dry_run: bool,
    date_format: Option<String>,
) -> Result<organizer::OrganizeResult, String> {
    info!("Organizing by date");
    let files = organizer::scan_directory(&path).map_err(|e| e.to_string())?;
    let mut result = organizer::OrganizeResult {
        total_files: files.len(),
        moved: 0,
        skipped: 0,
        errors: Vec::new(),
        dry_run,
    };

    let fmt = match date_format.as_deref() {
        Some("fulldate") => "%Y/%m/%d",
        _ => "%Y/%m",
    };

    for (i, file) in files.iter().enumerate() {
        if file.is_dir {
            result.skipped += 1;
            continue;
        }

        // Use get_file_date() which prefers EXIF date taken, falls back to fs timestamps
        let datetime = organizer::get_file_date(&file.path).unwrap_or_else(|| {
            std::fs::metadata(&file.path)
                .and_then(|m| m.modified())
                .map(|t| {
                    let dt: chrono::DateTime<chrono::Local> = t.into();
                    dt
                })
                .unwrap_or_else(|_| chrono::Local::now())
        });

        let date_folder = datetime.format(fmt).to_string();
        let target_dir = std::path::Path::new(&path).join(&date_folder);

        if dry_run {
            result.moved += 1;
        } else {
            if !target_dir.exists() {
                std::fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
            }
            let target_file = organizer::unique_path(&target_dir.join(&file.name));
            match retry_move(std::path::Path::new(&file.path), &target_file).await {
                Ok(()) => {
                    result.moved += 1;
                    let _ = journal::record_file_operation(
                        "move",
                        &file.path,
                        &target_file.to_string_lossy(),
                    );
                }
                Err(e) => {
                    if is_permission_denied(&e) {
                        warn!(error = %e, file = %file.name, "Permission denied moving file");
                        result.errors.push(format!(
                            "Permission denied: {} (try running as administrator)",
                            file.name
                        ));
                    } else {
                        warn!(error = %e, file = %file.name, "Failed to move file");
                        result
                            .errors
                            .push(format!("Failed to move {}: {}", file.name, e));
                    }
                }
            }
        }

        let _ = app.emit(
            "afo://progress",
            ProgressEvent {
                current: i + 1,
                total: files.len(),
                file: file.name.clone(),
                status: if dry_run {
                    "preview".to_string()
                } else {
                    "moved".to_string()
                },
            },
        );
    }

    info!(
        moved = result.moved,
        skipped = result.skipped,
        "Organize by date complete"
    );
    Ok(result)
}

#[tauri::command]
pub async fn batch_rename(
    app: tauri::AppHandle,
    path: String,
    pattern: String,
    dry_run: bool,
) -> Result<organizer::OrganizeResult, String> {
    let files = organizer::scan_directory(&path).map_err(|e| e.to_string())?;
    let mut result = organizer::OrganizeResult {
        total_files: files.len(),
        moved: 0,
        skipped: 0,
        errors: Vec::new(),
        dry_run,
    };

    let mut counter = 1u32;

    for (i, file) in files.iter().enumerate() {
        if file.is_dir {
            result.skipped += 1;
            continue;
        }

        let name_no_ext = file.name.trim_end_matches(&format!(".{}", file.extension));
        let new_name = pattern
            .replace("{name}", name_no_ext)
            .replace("{ext}", &file.extension)
            .replace("{counter}", &counter.to_string());

        let new_path = std::path::Path::new(&path).join(&new_name);

        if dry_run {
            result.moved += 1;
        } else {
            let target = organizer::unique_path(&new_path);
            match retry_move(std::path::Path::new(&file.path), &target).await {
                Ok(()) => {
                    result.moved += 1;
                    let _ = journal::record_file_operation(
                        "rename",
                        &file.path,
                        &target.to_string_lossy(),
                    );
                }
                Err(e) => {
                    if is_permission_denied(&e) {
                        warn!(error = %e, file = %file.name, "Permission denied renaming file");
                        result.errors.push(format!(
                            "Permission denied: {} (try running as administrator)",
                            file.name
                        ));
                    } else {
                        result
                            .errors
                            .push(format!("Failed to rename {}: {}", file.name, e));
                    }
                }
            }
        }

        counter += 1;

        let _ = app.emit(
            "afo://progress",
            ProgressEvent {
                current: i + 1,
                total: files.len(),
                file: file.name.clone(),
                status: if dry_run {
                    "preview".to_string()
                } else {
                    "renamed".to_string()
                },
            },
        );
    }

    Ok(result)
}

#[tauri::command]
pub async fn list_rules() -> Result<Vec<rule_engine::Rule>, String> {
    Ok(rule_engine::load_rules())
}

#[tauri::command]
pub async fn save_rules(rules: Vec<rule_engine::Rule>) -> Result<(), String> {
    rule_engine::save_rules(&rules).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_rules(rules: Vec<rule_engine::Rule>) -> Result<String, String> {
    serde_json::to_string_pretty(&rules).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn import_rules(json: String) -> Result<Vec<rule_engine::Rule>, String> {
    let rules: Vec<rule_engine::Rule> =
        serde_json::from_str(&json).map_err(|e| format!("Invalid rules JSON: {e}"))?;
    for rule in &rules {
        if rule.name.is_empty() {
            return Err("Rule name cannot be empty".into());
        }
        if rule.conditions.is_empty() {
            return Err(format!("Rule '{}' has no conditions", rule.name));
        }
        if rule.actions.is_empty() {
            return Err(format!("Rule '{}' has no actions", rule.name));
        }
    }
    Ok(rules)
}

#[tauri::command]
pub async fn apply_rules(path: String, dry_run: bool) -> Result<organizer::OrganizeResult, String> {
    rule_engine::apply_rules(&path, dry_run).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn scan_duplicates_cmd(
    path: String,
    recursive: bool,
    max_depth: Option<u32>,
) -> Result<Vec<duplicates::DuplicateGroup>, String> {
    let depth = max_depth.unwrap_or(5);
    duplicates::scan_duplicates(&path, recursive, depth).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn quarantine_duplicates_cmd(
    groups: Vec<duplicates::DuplicateGroup>,
    indices: Vec<usize>,
) -> Result<(), String> {
    duplicates::quarantine_duplicates(&groups, &indices).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_duplicates_cmd(
    groups: Vec<duplicates::DuplicateGroup>,
    indices: Vec<usize>,
) -> Result<(), String> {
    duplicates::delete_duplicates(&groups, &indices).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cleanup_quarantine_cmd(max_age_days: Option<u64>) -> Result<u64, String> {
    let days = max_age_days.unwrap_or(30);
    info!(max_age_days = days, "Cleaning up quarantine");
    duplicates::cleanup_quarantine(days).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_history(
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<journal::JournalEntry>, String> {
    journal::get_history(limit.unwrap_or(50), offset.unwrap_or(0))
}

#[tauri::command]
pub async fn search_history(
    filter: journal::HistoryFilter,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<journal::JournalEntry>, String> {
    journal::search_history(&filter, limit.unwrap_or(50), offset.unwrap_or(0))
}

#[tauri::command]
pub async fn undo_last() -> Result<Option<journal::JournalEntry>, String> {
    journal::undo_last()
}

#[tauri::command]
pub async fn undo_operation(id: i64) -> Result<Option<journal::JournalEntry>, String> {
    journal::undo_operation(id)
}

#[tauri::command]
pub async fn redo_last() -> Result<Option<journal::JournalEntry>, String> {
    journal::redo_last()
}

#[tauri::command]
pub async fn get_metadata(path: String) -> Result<metadata::Metadata, String> {
    Ok(metadata::extract_metadata(&path))
}

#[tauri::command]
pub async fn watch_directory(dir: String) -> Result<(), String> {
    watcher::start_watching(&dir).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn unwatch_directory(dir: String) -> Result<(), String> {
    watcher::stop_watching(&dir).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_watched_directories() -> Result<Vec<watcher::WatchedDir>, String> {
    watcher::list_watched()
}

#[tauri::command]
pub async fn create_schedule_cmd(
    name: String,
    cron: String,
    action_type: String,
    path: String,
) -> Result<scheduler::Schedule, String> {
    let action = match action_type.as_str() {
        "organize_extension" => scheduler::ScheduleAction::OrganizeByExtension { path },
        "organize_date" => scheduler::ScheduleAction::OrganizeByDate { path },
        "apply_rules" => scheduler::ScheduleAction::ApplyRules { path },
        "scan_duplicates" => scheduler::ScheduleAction::ScanDuplicates { path },
        _ => return Err(format!("Unknown action type: {}", action_type)),
    };
    scheduler::create_schedule(&name, &cron, action)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_schedules_cmd() -> Result<Vec<scheduler::Schedule>, String> {
    scheduler::list_schedules()
}

#[tauri::command]
pub async fn delete_schedule_cmd(id: String) -> Result<(), String> {
    scheduler::delete_schedule(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_schedule_cmd(id: String, enabled: bool) -> Result<(), String> {
    scheduler::toggle_schedule(&id, enabled).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn run_schedule_now(app: tauri::AppHandle, id: String) -> Result<(), String> {
    scheduler::run_now(&id, &app)
        .await
        .map_err(|e| e.to_string())
}

// Cloud sync stubs (post-launch)

#[tauri::command]
pub async fn cloud_list_providers() -> Result<Vec<cloud_sync::CloudProvider>, String> {
    cloud_sync::list_providers().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cloud_sync_now(path: String) -> Result<(), String> {
    cloud_sync::sync_to_cloud(&path).map_err(|e| e.to_string())
}

// ML categorization stub (post-launch)

#[tauri::command]
pub async fn ml_suggest_category(file_path: String) -> Result<String, String> {
    // Simple TF-IDF-like heuristic: match filename against known category keywords
    let name = std::path::Path::new(&file_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let categories: Vec<(&[&str], &str)> = vec![
        (
            &["screenshot", "photo", "img", "image", "pic", "wallpaper"],
            "images",
        ),
        (
            &["invoice", "resume", "report", "contract", "doc", "pdf"],
            "documents",
        ),
        (
            &["song", "music", "audio", "podcast", "track", "album"],
            "audio",
        ),
        (
            &["video", "movie", "clip", "tutorial", "stream", "recording"],
            "video",
        ),
        (&["backup", "archive", "zip", "export", "dump"], "archives"),
        (
            &["main", "index", "app", "config", "test", "lib", "src"],
            "code",
        ),
    ];

    for (keywords, category) in &categories {
        if keywords.iter().any(|k| name.contains(k)) {
            return Ok(category.to_string());
        }
    }

    Ok("other".to_string())
}

// ── Capture Commands ────────────────────────────────────────────────

#[tauri::command]
pub async fn get_capture_config() -> Result<capture::CaptureConfig, String> {
    Ok(capture::load_capture_config())
}

#[tauri::command]
pub async fn set_capture_mode_cmd(dir: String, mode: String) -> Result<(), String> {
    let capture_mode = match mode.as_str() {
        "auto_organize" => capture::CaptureMode::AutoOrganize,
        "notify_only" => capture::CaptureMode::NotifyOnly,
        "full_capture" => capture::CaptureMode::FullCapture,
        _ => return Err(format!("Unknown capture mode: {}", mode)),
    };
    capture::set_capture_mode(&dir, capture_mode)
}

#[tauri::command]
pub async fn set_scan_interval_cmd(dir: String, minutes: Option<u64>) -> Result<(), String> {
    capture::set_scan_interval(&dir, minutes)
}

#[tauri::command]
pub async fn toggle_always_allow_cmd(dir: String, rule_id: String, allow: bool) -> Result<(), String> {
    capture::toggle_always_allow(&dir, &rule_id, allow)
}

#[tauri::command]
pub async fn set_dir_enabled_cmd(dir: String, enabled: bool) -> Result<(), String> {
    capture::set_dir_enabled(&dir, enabled)
}

#[tauri::command]
pub async fn remove_directory_cmd(dir: String) -> Result<(), String> {
    capture::remove_directory(&dir)
}

#[tauri::command]
pub async fn search_file_index(
    query: String,
    ext_filter: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<capture::IndexedFile>, String> {
    capture::search_index(&query, ext_filter.as_deref(), limit.unwrap_or(50))
}

#[tauri::command]
pub async fn get_indexed_files_cmd(
    dir: String,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<capture::IndexedFile>, String> {
    capture::get_indexed_files(&dir, limit.unwrap_or(50), offset.unwrap_or(0))
}

#[tauri::command]
pub async fn scan_and_index_cmd(dir: String) -> Result<i64, String> {
    capture::scan_and_index(&dir)
}

#[tauri::command]
pub async fn get_file_history_cmd(
    path: String,
    limit: Option<i64>,
) -> Result<Vec<capture::FileChange>, String> {
    capture::get_file_history(&path, limit.unwrap_or(20))
}

#[tauri::command]
pub async fn get_recent_changes_cmd(
    dir: Option<String>,
    minutes: Option<i64>,
) -> Result<Vec<capture::FileChange>, String> {
    capture::get_recent_changes(dir.as_deref(), minutes.unwrap_or(60), 100)
}

#[tauri::command]
pub async fn get_pending_actions_cmd(
    dir: Option<String>,
) -> Result<Vec<capture::PendingAction>, String> {
    capture::get_pending_actions(dir.as_deref())
}

#[tauri::command]
pub async fn approve_pending_action_cmd(id: i64) -> Result<Option<capture::PendingAction>, String> {
    capture::approve_pending_action(id)
}

#[tauri::command]
pub async fn reject_pending_action_cmd(id: i64) -> Result<(), String> {
    capture::reject_pending_action(id)
}

#[tauri::command]
pub async fn approve_all_pending_cmd(
    dir: Option<String>,
) -> Result<Vec<capture::PendingAction>, String> {
    capture::approve_all_pending(dir.as_deref())
}

#[tauri::command]
pub async fn reject_all_pending_cmd(dir: Option<String>) -> Result<(), String> {
    capture::reject_all_pending(dir.as_deref())
}

#[tauri::command]
pub async fn get_capture_stats_cmd() -> Result<capture::CaptureStats, String> {
    capture::get_capture_stats()
}

#[tauri::command]
pub async fn get_dir_stats_cmd(dir: String) -> Result<capture::DirStats, String> {
    capture::get_dir_stats(&dir)
}

// ── Storage Breakdown ───────────────────────────────────────────────

#[derive(serde::Serialize)]
pub struct CategoryBreakdown {
    pub label: String,
    pub bytes: u64,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageBreakdownResult {
    pub directory: String,
    pub total_scanned_bytes: u64,
    pub categories: Vec<CategoryBreakdown>,
    pub total_space: u64,
    pub available_space: u64,
}

#[tauri::command]
pub async fn scan_storage_breakdown(directory: String) -> Result<StorageBreakdownResult, String> {
    use crate::core::organizer::CategoryConfig;

    if !std::path::Path::new(&directory).is_dir() {
        return Err(format!("{} is not a directory", directory));
    }

    let config = CategoryConfig::load();
    let dir_clone = directory.clone();

    // Collect results in a blocking task to avoid freezing the UI
    let result = tokio::task::spawn_blocking(move || {
        let mut category_sizes: std::collections::HashMap<String, u64> =
            std::collections::HashMap::new();
        let mut total_bytes: u64 = 0;

        fn walk_dir(
            path: &std::path::Path,
            config: &CategoryConfig,
            category_sizes: &mut std::collections::HashMap<String, u64>,
            total_bytes: &mut u64,
        ) {
            let entries = match std::fs::read_dir(path) {
                Ok(e) => e,
                Err(_) => return, // skip permission-denied dirs
            };

            for entry in entries {
                let entry = match entry {
                    Ok(e) => e,
                    Err(_) => continue,
                };
                let metadata = match entry.metadata() {
                    Ok(m) => m,
                    Err(_) => continue,
                };

                if metadata.is_dir() {
                    walk_dir(&entry.path(), config, category_sizes, total_bytes);
                } else if metadata.is_file() {
                    let size = metadata.len();
                    *total_bytes += size;

                    let ext = entry
                        .path()
                        .extension()
                        .map(|e| e.to_string_lossy().to_string())
                        .unwrap_or_default();

                    let category = config.categorize(&ext);
                    // Capitalize first letter for display
                    let label = match category {
                        "images" => "Images",
                        "documents" => "Documents",
                        "audio" => "Audio",
                        "video" => "Video",
                        "archives" => "Archives",
                        "code" => "Code",
                        _ => "Other",
                    };
                    *category_sizes
                        .entry(label.to_string())
                        .or_insert(0) += size;
                }
            }
        }

        walk_dir(
            std::path::Path::new(&dir_clone),
            &config,
            &mut category_sizes,
            &mut total_bytes,
        );

        // Build sorted categories (largest first)
        let mut categories: Vec<CategoryBreakdown> = category_sizes
            .into_iter()
            .map(|(label, bytes)| CategoryBreakdown { label, bytes })
            .collect();
        categories.sort_by(|a, b| b.bytes.cmp(&a.bytes));

        // Get disk space for the directory's mount point
        let (total_space, available_space) = {
            use sysinfo::Disks;
            let disks = Disks::new_with_refreshed_list();
            let dir_path = std::path::Path::new(&dir_clone);
            // Find the disk with the longest matching mount point
            let mut best_match: Option<(u64, u64)> = None;
            let mut best_len = 0;
            for disk in disks.iter() {
                let mount = disk.mount_point();
                if dir_path.starts_with(mount) && mount.to_string_lossy().len() > best_len {
                    best_len = mount.to_string_lossy().len();
                    best_match = Some((disk.total_space(), disk.available_space()));
                }
            }
            best_match.unwrap_or((0, 0))
        };

        StorageBreakdownResult {
            directory: dir_clone,
            total_scanned_bytes: total_bytes,
            categories,
            total_space,
            available_space,
        }
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command]
pub async fn get_system_disks() -> Result<Vec<disks::DiskInfo>, String> {
    Ok(disks::get_system_disks())
}

#[cfg(test)]
mod import_tests {
    use super::*;

    #[test]
    fn test_package_json_rejected() {
        let result = tokio_test::block_on(import_rules(r#"{"name":"afo","version":"3.0.3"}"#.into()));
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("Invalid rules JSON"), "Error was: {err}");
    }

    #[test]
    fn test_empty_object_rejected() {
        let result = tokio_test::block_on(import_rules("{}".into()));
        assert!(result.is_err());
    }

    #[test]
    fn test_empty_array_accepted() {
        let result = tokio_test::block_on(import_rules("[]".into()));
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[test]
    fn test_missing_fields_rejected() {
        let result = tokio_test::block_on(import_rules(r#"[{"name":"test"}]"#.into()));
        assert!(result.is_err());
    }

    #[test]
    fn test_empty_name_rejected() {
        let result = tokio_test::block_on(import_rules(r#"[{"id":"1","name":"","enabled":true,"conditions":[{"field":"Extension","operator":"Equals","value":".pdf"}],"actions":[{"Move":{"destination":"~/Docs"}}]}]"#.into()));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("cannot be empty"));
    }

    #[test]
    fn test_no_conditions_rejected() {
        let result = tokio_test::block_on(import_rules(r#"[{"id":"1","name":"Test","enabled":true,"conditions":[],"actions":[{"Move":{"destination":"~/Docs"}}]}]"#.into()));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("no conditions"));
    }

    #[test]
    fn test_no_actions_rejected() {
        let result = tokio_test::block_on(import_rules(r#"[{"id":"1","name":"Test","enabled":true,"conditions":[{"field":"Extension","operator":"Equals","value":".pdf"}],"actions":[]}]"#.into()));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("no actions"));
    }

    #[test]
    fn test_random_text_rejected() {
        let result = tokio_test::block_on(import_rules("hello world".into()));
        assert!(result.is_err());
    }

    #[test]
    fn test_valid_rule_accepted() {
        let result = tokio_test::block_on(import_rules(r#"[{"id":"1","name":"Good Rule","enabled":true,"conditions":[{"field":"Extension","operator":"Equals","value":".pdf"}],"actions":[{"Move":{"destination":"~/Docs"}}]}]"#.into()));
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 1);
    }

    #[test]
    fn test_round_trip_export_import_diff() {
        // Create 2 rules with DIFFERENT condition and action types
        let originals: Vec<rule_engine::Rule> = vec![
            rule_engine::Rule {
                id: "rule-pdf-docs".into(),
                name: "PDF to Documents".into(),
                enabled: true,
                conditions: vec![
                    rule_engine::Condition {
                        field: rule_engine::ConditionField::Extension,
                        operator: rule_engine::Operator::Equals,
                        value: ".pdf".into(),
                    },
                    rule_engine::Condition {
                        field: rule_engine::ConditionField::Size,
                        operator: rule_engine::Operator::GreaterThan,
                        value: "1048576".into(),
                    },
                ],
                actions: vec![
                    rule_engine::Action::Move { destination: "~/Documents".into() },
                ],
            },
            rule_engine::Rule {
                id: "rule-screenshots".into(),
                name: "Screenshots to Pictures".into(),
                enabled: false,
                conditions: vec![
                    rule_engine::Condition {
                        field: rule_engine::ConditionField::Name,
                        operator: rule_engine::Operator::Regex,
                        value: "(?i)screenshot|screen.?shot".into(),
                    },
                ],
                actions: vec![
                    rule_engine::Action::Rename { pattern: "{name}_{counter}{ext}".into() },
                    rule_engine::Action::Copy { destination: "~/Pictures/Screenshots".into() },
                ],
            },
        ];

        // Export
        let json = tokio_test::block_on(export_rules(originals.clone())).unwrap();
        assert!(json.contains("PDF to Documents"));
        assert!(json.contains("Screenshots to Pictures"));

        // Re-import
        let reimported = tokio_test::block_on(import_rules(json)).unwrap();
        assert_eq!(reimported.len(), 2);

        // Sort by name for deterministic comparison
        let mut orig_sorted = originals.clone();
        orig_sorted.sort_by(|a, b| a.name.cmp(&b.name));
        let mut reimp_sorted = reimported;
        reimp_sorted.sort_by(|a, b| a.name.cmp(&b.name));

        // Field-by-field diff
        for (orig, reimp) in orig_sorted.iter().zip(reimp_sorted.iter()) {
            assert_eq!(orig.name, reimp.name, "name mismatch");
            assert_eq!(orig.id, reimp.id, "id mismatch");
            assert_eq!(orig.enabled, reimp.enabled, "enabled mismatch");
            assert_eq!(orig.conditions.len(), reimp.conditions.len(), "conditions count mismatch for '{}'", orig.name);

            for (i, (oc, rc)) in orig.conditions.iter().zip(reimp.conditions.iter()).enumerate() {
                assert_eq!(format!("{:?}", oc.field), format!("{:?}", rc.field), "condition[{}] field mismatch in '{}'", i, orig.name);
                assert_eq!(format!("{:?}", oc.operator), format!("{:?}", rc.operator), "condition[{}] operator mismatch in '{}'", i, orig.name);
                assert_eq!(oc.value, rc.value, "condition[{}] value mismatch in '{}'", i, orig.name);
            }

            assert_eq!(orig.actions.len(), reimp.actions.len(), "actions count mismatch for '{}'", orig.name);

            for (i, (oa, ra)) in orig.actions.iter().zip(reimp.actions.iter()).enumerate() {
                assert_eq!(format!("{:?}", oa), format!("{:?}", ra), "action[{}] mismatch in '{}': {:?} vs {:?}", i, orig.name, oa, ra);
            }
        }

        // Exact JSON round-trip: re-export reimported and compare
        let reexport = tokio_test::block_on(export_rules(reimp_sorted.clone())).unwrap();
        let reimport2 = tokio_test::block_on(import_rules(reexport)).unwrap();
        assert_eq!(reimp_sorted.len(), reimport2.len());
        for (a, b) in reimp_sorted.iter().zip(reimport2.iter()) {
            assert_eq!(format!("{:?}", a), format!("{:?}", b), "double round-trip mismatch for '{}'", a.name);
        }
    }
}
