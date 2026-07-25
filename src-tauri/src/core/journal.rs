// Undo/redo journal — SQLite via rusqlite

use std::fs;
use std::path::Path;
use std::sync::{Mutex, OnceLock};

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JournalEntry {
    pub id: i64,
    pub operation_type: String,
    pub source_path: String,
    pub dest_path: String,
    pub timestamp: String,
    pub reverted: bool,
}

static DB: OnceLock<Mutex<Connection>> = OnceLock::new();

fn db_path() -> std::path::PathBuf {
    let base = dirs::data_local_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    base.join("afo").join("journal.db")
}

pub fn with_connection<F, R>(f: F) -> Result<R, String>
where
    F: FnOnce(&Connection) -> Result<R, String>,
{
    let db = DB
        .get()
        .ok_or("Journal not initialized — call init_journal()")?
        .lock()
        .map_err(|e| e.to_string())?;
    f(&db)
}

pub fn init_journal() -> Result<(), Box<dyn std::error::Error>> {
    let path = db_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    // Try to open existing database, backup if corrupt
    let db = match Connection::open(&path) {
        Ok(conn) => {
            // Verify database integrity
            let is_valid: bool = conn
                .pragma_query_value(None, "integrity_check", |row| row.get(0))
                .unwrap_or(false);
            if !is_valid {
                // Backup corrupt database
                let backup_path = path.with_extension("db.bak");
                let _ = fs::copy(&path, &backup_path);
                fs::remove_file(&path)?;
                Connection::open(&path)?
            } else {
                conn
            }
        }
        Err(_) => Connection::open(&path)?,
    };

    db.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA busy_timeout = 5000;
         CREATE TABLE IF NOT EXISTS operations (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             operation_type TEXT NOT NULL,
             source_path TEXT NOT NULL,
             dest_path TEXT NOT NULL,
             timestamp TEXT NOT NULL,
             reverted INTEGER NOT NULL DEFAULT 0
         );
         CREATE INDEX IF NOT EXISTS idx_ops_reverted_ts ON operations(reverted, timestamp DESC);",
    )?;
    DB.set(Mutex::new(db))
        .map_err(|_| "Journal already initialized")?;
    Ok(())
}

pub fn record_operation(entry: &JournalEntry) -> Result<(), String> {
    with_connection(|db| {
        db.execute(
            "INSERT INTO operations (operation_type, source_path, dest_path, timestamp, reverted)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                entry.operation_type,
                entry.source_path,
                entry.dest_path,
                entry.timestamp,
                entry.reverted as i32,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
}

/// Helper to record a file move/rename operation to the journal.
/// Used by both manual (commands.rs) and scheduled (organizer.rs) code paths.
pub fn record_file_operation(
    operation_type: &str,
    source_path: &str,
    dest_path: &str,
) -> Result<(), String> {
    let entry = JournalEntry {
        id: 0,
        operation_type: operation_type.to_string(),
        source_path: source_path.to_string(),
        dest_path: dest_path.to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        reverted: false,
    };
    record_operation(&entry)
}

pub fn get_history(limit: i64, offset: i64) -> Result<Vec<JournalEntry>, String> {
    with_connection(|db| {
        let mut stmt = db
            .prepare(
                "SELECT id, operation_type, source_path, dest_path, timestamp, reverted
                 FROM operations
                 ORDER BY timestamp DESC
                 LIMIT ?1 OFFSET ?2",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![limit, offset], |row| {
                Ok(JournalEntry {
                    id: row.get(0)?,
                    operation_type: row.get(1)?,
                    source_path: row.get(2)?,
                    dest_path: row.get(3)?,
                    timestamp: row.get(4)?,
                    reverted: row.get::<_, i32>(5)? != 0,
                })
            })
            .map_err(|e| e.to_string())?;
        let entries: Vec<JournalEntry> = rows.filter_map(|r| r.ok()).collect();
        Ok(entries)
    })
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HistoryFilter {
    pub query: Option<String>,
    pub operation_type: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
}

pub fn search_history(
    filter: &HistoryFilter,
    limit: i64,
    offset: i64,
) -> Result<Vec<JournalEntry>, String> {
    with_connection(|db| {
        let mut conditions: Vec<String> = Vec::new();
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(ref op) = filter.operation_type {
            if !op.is_empty() && op != "all" {
                conditions.push("operation_type = ?".into());
                param_values.push(Box::new(op.clone()));
            }
        }

        if let Some(ref q) = filter.query {
            if !q.is_empty() {
                let pattern = format!("%{q}%");
                conditions.push("(source_path LIKE ? OR dest_path LIKE ?)".into());
                param_values.push(Box::new(pattern.clone()));
                param_values.push(Box::new(pattern));
            }
        }

        if let Some(ref from) = filter.date_from {
            if !from.is_empty() {
                conditions.push("timestamp >= ?".into());
                param_values.push(Box::new(from.clone()));
            }
        }

        if let Some(ref to) = filter.date_to {
            if !to.is_empty() {
                conditions.push("timestamp <= ?".into());
                param_values.push(Box::new(to.clone()));
            }
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        let sql = format!(
            "SELECT id, operation_type, source_path, dest_path, timestamp, reverted
             FROM operations {where_clause}
             ORDER BY timestamp DESC
             LIMIT ? OFFSET ?"
        );

        let mut stmt = db.prepare(&sql).map_err(|e| e.to_string())?;

        let mut params: Vec<&dyn rusqlite::types::ToSql> = param_values
            .iter()
            .map(|p| p.as_ref() as &dyn rusqlite::types::ToSql)
            .collect();
        params.push(&limit);
        params.push(&offset);

        let rows = stmt
            .query_map(params.as_slice(), |row| {
                Ok(JournalEntry {
                    id: row.get(0)?,
                    operation_type: row.get(1)?,
                    source_path: row.get(2)?,
                    dest_path: row.get(3)?,
                    timestamp: row.get(4)?,
                    reverted: row.get::<_, i32>(5)? != 0,
                })
            })
            .map_err(|e| e.to_string())?;
        let entries: Vec<JournalEntry> = rows.filter_map(|r| r.ok()).collect();
        Ok(entries)
    })
}

/// Reverse a file operation based on its type
fn reverse_operation(entry: &JournalEntry) -> Result<(), Box<dyn std::error::Error>> {
    let src = Path::new(&entry.source_path);
    let dest = Path::new(&entry.dest_path);

    match entry.operation_type.as_str() {
        "move" => {
            // Move was: source -> dest
            // Undo: move dest -> source
            if dest.exists() {
                if let Some(parent) = src.parent() {
                    fs::create_dir_all(parent)?;
                }
                fs::rename(dest, src)?;
            }
        }
        "copy" => {
            // Copy was: source -> dest (source still exists)
            // Undo: delete dest
            if dest.exists() {
                fs::remove_file(dest)?;
            }
        }
        "rename" => {
            // Rename was: source -> dest
            // Undo: rename dest -> source
            if dest.exists() {
                fs::rename(dest, src)?;
            }
        }
        _ => {
            return Err(format!("Unknown operation type: {}", entry.operation_type).into());
        }
    }

    Ok(())
}

/// Forward a file operation (redo)
fn forward_operation(entry: &JournalEntry) -> Result<(), Box<dyn std::error::Error>> {
    let src = Path::new(&entry.source_path);
    let dest = Path::new(&entry.dest_path);

    match entry.operation_type.as_str() {
        "move" => {
            // Redo: move source -> dest
            if src.exists() {
                if let Some(parent) = dest.parent() {
                    fs::create_dir_all(parent)?;
                }
                fs::rename(src, dest)?;
            }
        }
        "copy" => {
            // Redo: copy source -> dest
            if src.exists() {
                if let Some(parent) = dest.parent() {
                    fs::create_dir_all(parent)?;
                }
                fs::copy(src, dest)?;
            }
        }
        "rename" => {
            // Redo: rename source -> dest
            if src.exists() {
                fs::rename(src, dest)?;
            }
        }
        _ => {
            return Err(format!("Unknown operation type: {}", entry.operation_type).into());
        }
    }

    Ok(())
}

pub fn undo_last() -> Result<Option<JournalEntry>, String> {
    let entry = with_connection(|db| {
        let entry: Option<JournalEntry> = db
            .query_row(
                "SELECT id, operation_type, source_path, dest_path, timestamp, reverted
                 FROM operations
                 WHERE reverted = 0
                 ORDER BY timestamp DESC
                 LIMIT 1",
                [],
                |row| {
                    Ok(JournalEntry {
                        id: row.get(0)?,
                        operation_type: row.get(1)?,
                        source_path: row.get(2)?,
                        dest_path: row.get(3)?,
                        timestamp: row.get(4)?,
                        reverted: row.get::<_, i32>(5)? != 0,
                    })
                },
            )
            .optional()
            .map_err(|e| e.to_string())?;
        Ok(entry)
    })?;

    if let Some(ref e) = entry {
        // Actually reverse the file operation
        reverse_operation(e).map_err(|e| e.to_string())?;

        // Mark as reverted in DB
        with_connection(|db| {
            db.execute(
                "UPDATE operations SET reverted = 1 WHERE id = ?1",
                params![e.id],
            )
            .map_err(|e| e.to_string())?;
            Ok(())
        })?;
    }

    Ok(entry)
}

pub fn undo_operation(id: i64) -> Result<Option<JournalEntry>, String> {
    let entry = with_connection(|db| {
        let entry: Option<JournalEntry> = db
            .query_row(
                "SELECT id, operation_type, source_path, dest_path, timestamp, reverted
                 FROM operations
                 WHERE id = ?1",
                params![id],
                |row| {
                    Ok(JournalEntry {
                        id: row.get(0)?,
                        operation_type: row.get(1)?,
                        source_path: row.get(2)?,
                        dest_path: row.get(3)?,
                        timestamp: row.get(4)?,
                        reverted: row.get::<_, i32>(5)? != 0,
                    })
                },
            )
            .optional()
            .map_err(|e| e.to_string())?;
        Ok(entry)
    })?;

    if let Some(ref e) = entry {
        // If already reverted, this is a no-op (prevents double-reverse)
        if e.reverted {
            return Ok(entry);
        }

        // Actually reverse the file operation
        reverse_operation(e).map_err(|e| e.to_string())?;

        // Mark as reverted in DB
        with_connection(|db| {
            db.execute(
                "UPDATE operations SET reverted = 1 WHERE id = ?1",
                params![e.id],
            )
            .map_err(|e| e.to_string())?;
            Ok(())
        })?;
    }

    Ok(entry)
}

pub fn redo_last() -> Result<Option<JournalEntry>, String> {
    let entry = with_connection(|db| {
        let entry: Option<JournalEntry> = db
            .query_row(
                "SELECT id, operation_type, source_path, dest_path, timestamp, reverted
                 FROM operations
                 WHERE reverted = 1
                 ORDER BY timestamp DESC
                 LIMIT 1",
                [],
                |row| {
                    Ok(JournalEntry {
                        id: row.get(0)?,
                        operation_type: row.get(1)?,
                        source_path: row.get(2)?,
                        dest_path: row.get(3)?,
                        timestamp: row.get(4)?,
                        reverted: row.get::<_, i32>(5)? != 0,
                    })
                },
            )
            .optional()
            .map_err(|e| e.to_string())?;
        Ok(entry)
    })?;

    if let Some(ref e) = entry {
        // Actually redo the file operation
        forward_operation(e).map_err(|e| e.to_string())?;

        // Mark as not reverted in DB
        with_connection(|db| {
            db.execute(
                "UPDATE operations SET reverted = 0 WHERE id = ?1",
                params![e.id],
            )
            .map_err(|e| e.to_string())?;
            Ok(())
        })?;
    }

    Ok(entry)
}

#[cfg(test)]
mod search_tests {
    use super::*;
    use std::sync::{Mutex, OnceLock};

    static TEST_DB: OnceLock<Mutex<Connection>> = OnceLock::new();
    static TEST_MUTEX: Mutex<()> = Mutex::new(());

    fn setup_test_db() {
        TEST_DB.get_or_init(|| {
            let conn = Connection::open_in_memory().unwrap();
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS operations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    operation_type TEXT NOT NULL,
                    source_path TEXT NOT NULL,
                    dest_path TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    reverted INTEGER NOT NULL DEFAULT 0
                );",
            ).unwrap();
            Mutex::new(conn)
        });
        // Clear table between tests
        let db = TEST_DB.get().unwrap().lock().unwrap();
        db.execute("DELETE FROM operations", []).unwrap();
    }

    fn insert_test_entry(op: &str, src: &str, dst: &str, ts: &str) {
        let db = TEST_DB.get().unwrap().lock().unwrap();
        db.execute(
            "INSERT INTO operations (operation_type, source_path, dest_path, timestamp, reverted)
             VALUES (?1, ?2, ?3, ?4, 0)",
            params![op, src, dst, ts],
        ).unwrap();
    }

    fn search_test(filter: &HistoryFilter, limit: i64, offset: i64) -> Result<Vec<JournalEntry>, String> {
        let db = TEST_DB.get().unwrap().lock().unwrap();
        let mut conditions: Vec<String> = Vec::new();
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(ref op) = filter.operation_type {
            if !op.is_empty() && op != "all" {
                conditions.push("operation_type = ?".into());
                param_values.push(Box::new(op.clone()));
            }
        }
        if let Some(ref q) = filter.query {
            if !q.is_empty() {
                let pattern = format!("%{q}%");
                conditions.push("(source_path LIKE ? OR dest_path LIKE ?)".into());
                param_values.push(Box::new(pattern.clone()));
                param_values.push(Box::new(pattern));
            }
        }
        if let Some(ref from) = filter.date_from {
            if !from.is_empty() {
                conditions.push("timestamp >= ?".into());
                param_values.push(Box::new(from.clone()));
            }
        }
        if let Some(ref to) = filter.date_to {
            if !to.is_empty() {
                conditions.push("timestamp <= ?".into());
                param_values.push(Box::new(to.clone()));
            }
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        let sql = format!(
            "SELECT id, operation_type, source_path, dest_path, timestamp, reverted
             FROM operations {where_clause}
             ORDER BY timestamp DESC
             LIMIT ? OFFSET ?"
        );

        let mut stmt = db.prepare(&sql).map_err(|e| e.to_string())?;
        let mut params: Vec<&dyn rusqlite::types::ToSql> = param_values
            .iter()
            .map(|p| p.as_ref() as &dyn rusqlite::types::ToSql)
            .collect();
        params.push(&limit);
        params.push(&offset);

        let rows = stmt
            .query_map(params.as_slice(), |row| {
                Ok(JournalEntry {
                    id: row.get(0)?,
                    operation_type: row.get(1)?,
                    source_path: row.get(2)?,
                    dest_path: row.get(3)?,
                    timestamp: row.get(4)?,
                    reverted: row.get::<_, i32>(5)? != 0,
                })
            })
            .map_err(|e| e.to_string())?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    #[test]
    fn test_search_by_query_finds_filename_in_source() {
        let _lock = TEST_MUTEX.lock().unwrap();
        setup_test_db();
        insert_test_entry("move", "/home/user/Downloads/photo.jpg", "/home/user/Images/photo.jpg", "2026-07-20T10:00:00Z");
        insert_test_entry("move", "/home/user/Downloads/doc.pdf", "/home/user/Documents/doc.pdf", "2026-07-20T11:00:00Z");

        let filter = HistoryFilter { query: Some("photo".into()), operation_type: None, date_from: None, date_to: None };
        let results = search_test(&filter, 50, 0).unwrap();
        assert_eq!(results.len(), 1);
        assert!(results[0].source_path.contains("photo"));
    }

    #[test]
    fn test_search_by_query_finds_filename_in_dest() {
        let _lock = TEST_MUTEX.lock().unwrap();
        setup_test_db();
        insert_test_entry("move", "/tmp/a.txt", "/home/user/Documents/report.pdf", "2026-07-20T10:00:00Z");

        let filter = HistoryFilter { query: Some("report".into()), operation_type: None, date_from: None, date_to: None };
        let results = search_test(&filter, 50, 0).unwrap();
        assert_eq!(results.len(), 1);
        assert!(results[0].dest_path.contains("report"));
    }

    #[test]
    fn test_search_by_operation_type() {
        let _lock = TEST_MUTEX.lock().unwrap();
        setup_test_db();
        insert_test_entry("move", "/tmp/a.txt", "/tmp/b.txt", "2026-07-20T10:00:00Z");
        insert_test_entry("copy", "/tmp/c.txt", "/tmp/d.txt", "2026-07-20T11:00:00Z");
        insert_test_entry("rename", "/tmp/e.txt", "/tmp/f.txt", "2026-07-20T12:00:00Z");

        let filter = HistoryFilter { query: None, operation_type: Some("copy".into()), date_from: None, date_to: None };
        let results = search_test(&filter, 50, 0).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].operation_type, "copy");
    }

    #[test]
    fn test_search_by_date_range() {
        let _lock = TEST_MUTEX.lock().unwrap();
        setup_test_db();
        insert_test_entry("move", "/tmp/a.txt", "/tmp/b.txt", "2026-07-19T10:00:00Z");
        insert_test_entry("move", "/tmp/c.txt", "/tmp/d.txt", "2026-07-20T10:00:00Z");
        insert_test_entry("move", "/tmp/e.txt", "/tmp/f.txt", "2026-07-21T10:00:00Z");

        let filter = HistoryFilter { query: None, operation_type: None, date_from: Some("2026-07-20T00:00:00Z".into()), date_to: Some("2026-07-20T23:59:59Z".into()) };
        let results = search_test(&filter, 50, 0).unwrap();
        assert_eq!(results.len(), 1);
        assert!(results[0].timestamp.contains("2026-07-20"));
    }

    #[test]
    fn test_search_combined_filters_use_and_logic() {
        let _lock = TEST_MUTEX.lock().unwrap();
        setup_test_db();
        insert_test_entry("move", "/tmp/a.txt", "/tmp/b.txt", "2026-07-20T10:00:00Z");
        insert_test_entry("copy", "/tmp/c.txt", "/tmp/d.txt", "2026-07-20T11:00:00Z");
        insert_test_entry("move", "/tmp/e.txt", "/tmp/f.txt", "2026-07-21T10:00:00Z");

        let filter = HistoryFilter { query: None, operation_type: Some("move".into()), date_from: Some("2026-07-20T00:00:00Z".into()), date_to: Some("2026-07-20T23:59:59Z".into()) };
        let results = search_test(&filter, 50, 0).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].operation_type, "move");
        assert!(results[0].timestamp.contains("2026-07-20"));
    }

    #[test]
    fn test_search_no_filters_returns_all() {
        let _lock = TEST_MUTEX.lock().unwrap();
        setup_test_db();
        insert_test_entry("move", "/tmp/a.txt", "/tmp/b.txt", "2026-07-20T10:00:00Z");
        insert_test_entry("copy", "/tmp/c.txt", "/tmp/d.txt", "2026-07-20T11:00:00Z");

        let filter = HistoryFilter { query: None, operation_type: None, date_from: None, date_to: None };
        let results = search_test(&filter, 50, 0).unwrap();
        assert!(results.len() >= 2);
    }

    #[test]
    fn test_search_query_is_case_insensitive_like() {
        let _lock = TEST_MUTEX.lock().unwrap();
        setup_test_db();
        insert_test_entry("move", "/home/user/Downloads/PHOTO.jpg", "/tmp/b.txt", "2026-07-20T10:00:00Z");

        let filter = HistoryFilter { query: Some("photo".into()), operation_type: None, date_from: None, date_to: None };
        let results = search_test(&filter, 50, 0).unwrap();
        assert_eq!(results.len(), 1);
    }
}
