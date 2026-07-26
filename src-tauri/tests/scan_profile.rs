//! Profiling test for scan_storage_breakdown
//! Run with: cargo test --package afo --test scan_profile -- --nocapture

use std::collections::HashMap;
use std::path::Path;
use std::time::Instant;

use afo_lib::core::organizer::CategoryConfig;

struct WalkResult {
    category_sizes: HashMap<String, u64>,
    total_bytes: u64,
    file_count: u64,
    dir_count: u64,
    errors: u64,
}

fn walk_dir(path: &Path, config: &CategoryConfig, result: &mut WalkResult) {
    let entries = match std::fs::read_dir(path) {
        Ok(e) => e,
        Err(_) => {
            result.errors += 1;
            return;
        }
    };

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => {
                result.errors += 1;
                continue;
            }
        };
        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => {
                result.errors += 1;
                continue;
            }
        };

        if metadata.is_dir() {
            result.dir_count += 1;
            walk_dir(&entry.path(), config, result);
        } else if metadata.is_file() {
            result.file_count += 1;
            let size = metadata.len();
            result.total_bytes += size;

            let ext = entry
                .path()
                .extension()
                .map(|e| e.to_string_lossy().to_string())
                .unwrap_or_default();

            let category = config.categorize(&ext);
            let label = match category {
                "images" => "Images",
                "documents" => "Documents",
                "audio" => "Audio",
                "video" => "Video",
                "archives" => "Archives",
                "code" => "Code",
                _ => "Other",
            };
            *result
                .category_sizes
                .entry(label.to_string())
                .or_insert(0) += size;
        }
    }
}

fn format_bytes(bytes: u64) -> String {
    if bytes == 0 {
        return "0 B".to_string();
    }
    let units = ["B", "KB", "MB", "GB", "TB"];
    let i = (bytes as f64).ln() / 1024_f64.ln();
    let i = i.floor() as usize;
    let i = i.min(units.len() - 1);
    format!(
        "{:.1} {}",
        bytes as f64 / 1024_f64.powi(i as i32),
        units[i]
    )
}

fn profile_directory(dir: &str) {
    let path = Path::new(dir);
    if !path.is_dir() {
        eprintln!("Not a directory: {}", dir);
        return;
    }

    let config = CategoryConfig::load();

    println!();
    println!("============================================================");
    println!("Profiling: {}", dir);
    println!("============================================================");

    // Warm up: read_dir the root to prime filesystem cache
    let _ = std::fs::read_dir(path);

    // Profile the walk
    let mut result = WalkResult {
        category_sizes: HashMap::new(),
        total_bytes: 0,
        file_count: 0,
        dir_count: 0,
        errors: 0,
    };

    let start = Instant::now();
    walk_dir(path, &config, &mut result);
    let elapsed = start.elapsed();

    println!("Files:       {}", result.file_count);
    println!("Directories: {}", result.dir_count);
    println!("Errors:      {}", result.errors);
    println!("Total size:  {}", format_bytes(result.total_bytes));
    println!("Walk time:   {:.2?}", elapsed);
    println!(
        "Files/sec:   {:.0}",
        result.file_count as f64 / elapsed.as_secs_f64()
    );

    // Profile disk info lookup
    let disk_start = Instant::now();
    {
        use sysinfo::Disks;
        let disks = Disks::new_with_refreshed_list();
        for disk in disks.iter() {
            let mount = disk.mount_point();
            if path.starts_with(mount) {
                println!(
                    "Disk:        {} (total: {}, free: {})",
                    mount.to_string_lossy(),
                    format_bytes(disk.total_space()),
                    format_bytes(disk.available_space())
                );
                break;
            }
        }
    }
    let disk_elapsed = disk_start.elapsed();
    println!("Disk lookup: {:.2?}", disk_elapsed);
    println!("Total:       {:.2?}", elapsed + disk_elapsed);

    // Category breakdown
    println!();
    println!("Category breakdown:");
    let mut cats: Vec<_> = result.category_sizes.iter().collect();
    cats.sort_by(|a, b| b.1.cmp(a.1));
    for (label, bytes) in cats {
        let pct = if result.total_bytes > 0 {
            *bytes as f64 / result.total_bytes as f64 * 100.0
        } else {
            0.0
        };
        println!(
            "  {:<12} {:>10} ({:>5.1}%)",
            label,
            format_bytes(*bytes),
            pct
        );
    }
}

#[test]
fn profile_downloads() {
    profile_directory("/home/anorak/Downloads");
}

#[test]
fn profile_cache() {
    profile_directory("/home/anorak/.cache");
}

#[test]
fn profile_codex() {
    profile_directory("/home/anorak/.codex");
}

/// Test mtime-based cache: scan the same directory twice.
/// Second scan should be instant if mtime hasn't changed.
#[test]
fn test_mtime_cache_behavior() {
    let dir = "/home/anorak/.cache";
    let path = Path::new(dir);
    if !path.is_dir() {
        eprintln!("Skipping cache test: {} not found", dir);
        return;
    }

    let config = CategoryConfig::load();

    // First scan: full walk
    let mut result1 = WalkResult {
        category_sizes: HashMap::new(),
        total_bytes: 0,
        file_count: 0,
        dir_count: 0,
        errors: 0,
    };
    let start1 = Instant::now();
    walk_dir(path, &config, &mut result1);
    let elapsed1 = start1.elapsed();

    // Get directory mtime
    let mtime = path.metadata().and_then(|m| m.modified()).ok();

    // Simulate cache check: if mtime unchanged, skip walk
    let start2 = Instant::now();
    let cached = if let Some(mtime) = mtime {
        // In real code, this checks SCAN_CACHE. Here we simulate by checking mtime again.
        let current_mtime = path.metadata().and_then(|m| m.modified()).ok();
        current_mtime == Some(mtime)
    } else {
        false
    };
    let elapsed2 = start2.elapsed();

    println!();
    println!("=== Cache behavior test ===");
    println!("First scan:  {:.2?} ({} files)", elapsed1, result1.file_count);
    println!(
        "Cache check: {:.2?} (mtime unchanged: {})",
        elapsed2, cached
    );
    if cached {
        println!("Second scan would be: SKIPPED (cache hit)");
    } else {
        println!("Second scan would be: full re-walk needed");
    }
    assert!(cached, "Directory mtime should not change between scans");
}
