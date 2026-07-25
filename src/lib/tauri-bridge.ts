import { invoke } from "@tauri-apps/api/core";

export interface FileInfo {
  name: string;
  path: string;
  extension: string;
  size: number;
  is_dir: boolean;
}

export interface OrganizeResult {
  total_files: number;
  moved: number;
  skipped: number;
  errors: string[];
  dry_run: boolean;
}

export async function scanDirectory(path: string): Promise<FileInfo[]> {
  return invoke<FileInfo[]>("scan_directory", { path });
}

export async function organizeByExtension(path: string, dryRun: boolean): Promise<OrganizeResult> {
  return invoke<OrganizeResult>("organize_by_extension", { path, dryRun });
}

export async function organizeByDate(path: string, dryRun: boolean, dateFormat?: string): Promise<OrganizeResult> {
  return invoke<OrganizeResult>("organize_by_date", { path, dryRun, dateFormat: dateFormat ?? "yearmonth" });
}

export async function batchRename(
  path: string,
  pattern: string,
  dryRun: boolean,
): Promise<OrganizeResult> {
  return invoke<OrganizeResult>("batch_rename", { path, pattern, dryRun });
}

// Rule Engine
export interface RuleCondition {
  field: "Extension" | "Name" | "Size" | "DateCreated" | "DateModified";
  operator:
    "Equals" | "Contains" | "StartsWith" | "EndsWith" | "GreaterThan" | "LessThan" | "Regex";
  value: string;
}

export interface RuleAction {
  Move?: { destination: string };
  Copy?: { destination: string };
  Rename?: { pattern: string };
}

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

export async function listRules(): Promise<Rule[]> {
  return invoke<Rule[]>("list_rules");
}

export async function saveRules(rules: Rule[]): Promise<void> {
  return invoke("save_rules", { rules });
}

export async function exportRules(rules: Rule[]): Promise<string> {
  return invoke<string>("export_rules", { rules });
}

export async function importRules(json: string): Promise<Rule[]> {
  return invoke<Rule[]>("import_rules", { json });
}

export async function applyRules(path: string, dryRun: boolean): Promise<OrganizeResult> {
  return invoke<OrganizeResult>("apply_rules", { path, dryRun });
}

// Duplicates
export interface DuplicateFile {
  path: string;
  size: number;
  is_keeper: boolean;
}

export interface DuplicateGroup {
  hash: string;
  files: DuplicateFile[];
  total_size: number;
}

export async function scanDuplicates(
  path: string,
  recursive: boolean,
  maxDepth?: number,
): Promise<DuplicateGroup[]> {
  return invoke<DuplicateGroup[]>("scan_duplicates_cmd", { path, recursive, maxDepth });
}

export async function quarantineDuplicates(
  groups: DuplicateGroup[],
  indices: number[],
): Promise<void> {
  return invoke("quarantine_duplicates_cmd", { groups, indices });
}

export async function deleteDuplicates(groups: DuplicateGroup[], indices: number[]): Promise<void> {
  return invoke("delete_duplicates_cmd", { groups, indices });
}

export async function cleanupQuarantine(maxAgeDays?: number): Promise<number> {
  return invoke<number>("cleanup_quarantine_cmd", { maxAgeDays });
}

// Journal
export interface JournalEntry {
  id: number;
  operation_type: string;
  source_path: string;
  dest_path: string;
  timestamp: string;
  reverted: boolean;
}

export async function getHistory(limit?: number, offset?: number): Promise<JournalEntry[]> {
  return invoke<JournalEntry[]>("get_history", { limit, offset });
}

export interface HistoryFilter {
  query?: string;
  operation_type?: string;
  date_from?: string;
  date_to?: string;
}

export async function searchHistory(
  filter: HistoryFilter,
  limit?: number,
  offset?: number,
): Promise<JournalEntry[]> {
  return invoke<JournalEntry[]>("search_history", { filter, limit, offset });
}

export async function undoLast(): Promise<JournalEntry | null> {
  return invoke<JournalEntry | null>("undo_last");
}

export async function undoOperation(id: number): Promise<JournalEntry | null> {
  return invoke<JournalEntry | null>("undo_operation", { id });
}

export async function redoLast(): Promise<JournalEntry | null> {
  return invoke<JournalEntry | null>("redo_last");
}

// Metadata
export interface ExifData {
  camera_make: string | null;
  camera_model: string | null;
  date_taken: string | null;
  gps: string | null;
  exposure: string | null;
}

export interface AudioData {
  artist: string | null;
  album: string | null;
  title: string | null;
  genre: string | null;
  track: number | null;
  year: number | null;
}

export interface FileMetadata {
  exif: ExifData | null;
  audio: AudioData | null;
}

export async function getMetadata(path: string): Promise<FileMetadata> {
  return invoke<FileMetadata>("get_metadata", { path });
}

// Watcher
export interface WatchedDir {
  path: string;
  enabled: boolean;
}

export async function watchDirectory(dir: string): Promise<void> {
  return invoke("watch_directory", { dir });
}

export async function unwatchDirectory(dir: string): Promise<void> {
  return invoke("unwatch_directory", { dir });
}

export async function listWatchedDirectories(): Promise<WatchedDir[]> {
  return invoke<WatchedDir[]>("list_watched_directories");
}

// Scheduler
export interface Schedule {
  id: string;
  name: string;
  cron: string;
  action: {
    OrganizeByExtension?: { path: string };
    OrganizeByDate?: { path: string };
    ApplyRules?: { path: string };
    ScanDuplicates?: { path: string };
  };
  enabled: boolean;
  last_run: string | null;
  next_run: string | null;
}

export async function createSchedule(
  name: string,
  cron: string,
  actionType: string,
  path: string,
): Promise<Schedule> {
  return invoke<Schedule>("create_schedule_cmd", { name, cron, actionType, path });
}

export async function listSchedules(): Promise<Schedule[]> {
  return invoke<Schedule[]>("list_schedules_cmd");
}

export async function deleteSchedule(id: string): Promise<void> {
  return invoke("delete_schedule_cmd", { id });
}

export async function toggleSchedule(id: string, enabled: boolean): Promise<void> {
  return invoke("toggle_schedule_cmd", { id, enabled });
}

export async function runScheduleNow(id: string): Promise<void> {
  return invoke("run_schedule_now", { id });
}

// Cloud sync stubs
export interface CloudProvider {
  id: string;
  name: string;
  provider_type: string;
  local_path: string;
  remote_path: string;
  enabled: boolean;
}

export async function cloudListProviders(): Promise<CloudProvider[]> {
  return invoke<CloudProvider[]>("cloud_list_providers");
}

export async function cloudSyncNow(path: string): Promise<void> {
  return invoke("cloud_sync_now", { path });
}

// ML categorization stub
export async function mlSuggestCategory(filePath: string): Promise<string> {
  return invoke<string>("ml_suggest_category", { filePath });
}

// ── Live Capture ────────────────────────────────────────────────────

export type CaptureMode = "auto_organize" | "notify_only" | "full_capture";

export interface DirectoryConfig {
  path: string;
  capture_mode: CaptureMode;
  enabled: boolean;
  always_allow_rules: string[];
  scan_interval_minutes: number | null;
}

export interface CaptureConfig {
  directories: DirectoryConfig[];
}

export interface IndexedFile {
  id: number;
  path: string;
  filename: string;
  extension: string;
  size: number;
  hash: string | null;
  watched_dir: string;
  created_at: string;
  modified_at: string;
  indexed_at: string;
  last_seen: string;
}

export interface FileChange {
  id: number;
  file_path: string;
  change_type: string;
  old_path: string | null;
  file_size: number | null;
  timestamp: string;
  watched_dir: string;
  metadata: string | null;
}

export interface PendingAction {
  id: number;
  source_path: string;
  dest_path: string;
  action_type: string;
  rule_name: string | null;
  watched_dir: string;
  created_at: string;
  status: string;
}

export interface CaptureStats {
  total_indexed_files: number;
  total_changes_today: number;
  pending_actions: number;
  watched_dirs_count: number;
  total_disk_usage: number;
  last_scan_time: string | null;
}

export interface DirStats {
  path: string;
  file_count: number;
  disk_usage: number;
  changes_per_minute: number;
  capture_mode: CaptureMode;
  active_rules: number;
  last_triggered_rule: string | null;
}

export async function getCaptureConfig(): Promise<CaptureConfig> {
  return invoke<CaptureConfig>("get_capture_config");
}

export async function setCaptureMode(dir: string, mode: CaptureMode): Promise<void> {
  return invoke("set_capture_mode_cmd", { dir, mode });
}

export async function setScanInterval(dir: string, minutes: number | null): Promise<void> {
  return invoke("set_scan_interval_cmd", { dir, minutes });
}

export async function toggleAlwaysAllow(dir: string, ruleId: string, allow: boolean): Promise<void> {
  return invoke("toggle_always_allow_cmd", { dir, ruleId, allow });
}

export async function setDirEnabled(dir: string, enabled: boolean): Promise<void> {
  return invoke("set_dir_enabled_cmd", { dir, enabled });
}

export async function removeDirectory(dir: string): Promise<void> {
  return invoke("remove_directory_cmd", { dir });
}

export async function searchFileIndex(query: string, extFilter?: string, limit?: number): Promise<IndexedFile[]> {
  return invoke<IndexedFile[]>("search_file_index", { query, extFilter: extFilter ?? null, limit: limit ?? 50 });
}

export async function getIndexedFiles(dir: string, limit?: number, offset?: number): Promise<IndexedFile[]> {
  return invoke<IndexedFile[]>("get_indexed_files_cmd", { dir, limit: limit ?? 50, offset: offset ?? 0 });
}

export async function scanAndIndex(dir: string): Promise<number> {
  return invoke<number>("scan_and_index_cmd", { dir });
}

export async function getFileHistory(path: string, limit?: number): Promise<FileChange[]> {
  return invoke<FileChange[]>("get_file_history_cmd", { path, limit: limit ?? 20 });
}

export async function getRecentChanges(dir?: string, minutes?: number): Promise<FileChange[]> {
  return invoke<FileChange[]>("get_recent_changes_cmd", { dir: dir ?? null, minutes: minutes ?? 60 });
}

export async function getPendingActions(dir?: string): Promise<PendingAction[]> {
  return invoke<PendingAction[]>("get_pending_actions_cmd", { dir: dir ?? null });
}

export async function approvePendingAction(id: number): Promise<PendingAction | null> {
  return invoke<PendingAction | null>("approve_pending_action_cmd", { id });
}

export async function rejectPendingAction(id: number): Promise<void> {
  return invoke("reject_pending_action_cmd", { id });
}

export async function approveAllPending(dir?: string): Promise<PendingAction[]> {
  return invoke<PendingAction[]>("approve_all_pending_cmd", { dir: dir ?? null });
}

export async function rejectAllPending(dir?: string): Promise<void> {
  return invoke("reject_all_pending_cmd", { dir: dir ?? null });
}

export async function getCaptureStats(): Promise<CaptureStats> {
  return invoke<CaptureStats>("get_capture_stats_cmd");
}

export async function getDirStats(dir: string): Promise<DirStats> {
  return invoke<DirStats>("get_dir_stats_cmd", { dir });
}

export interface DiskInfo {
  name: string;
  mount_point: string;
  total_space: number;
  available_space: number;
  file_system: string;
  is_removable: boolean;
}

export async function getSystemDisks(): Promise<DiskInfo[]> {
  return invoke<DiskInfo[]>("get_system_disks");
}
