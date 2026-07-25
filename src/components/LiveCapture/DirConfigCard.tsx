import { useState } from "react";
import { Scan, Trash2 } from "lucide-react";
import { showToast } from "../Toast";
import { type DirectoryConfig, type DirStats, type CaptureMode, setCaptureMode, setDirEnabled, scanAndIndex, unwatchDirectory, removeDirectory } from "../../lib/tauri-bridge";
import Button from "../ui/Button";
import Toggle from "../ui/Toggle";

const MODES: { value: CaptureMode; label: string; description: string }[] = [
  { value: "auto_organize", label: "Auto", description: "Silently move files matching rules" },
  { value: "notify_only", label: "Notify", description: "Queue moves for approval" },
  { value: "full_capture", label: "Capture", description: "Index everything, no auto-move" },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

interface Props {
  config: DirectoryConfig;
  stats: DirStats | null;
  onRemoved: () => void;
}

export default function DirConfigCard({ config, stats, onRemoved }: Props) {
  const [scanning, setScanning] = useState(false);

  async function handleModeChange(mode: CaptureMode) {
    try {
      await setCaptureMode(config.path, mode);
      onRemoved();
    } catch (e) {
      showToast(`Failed to change mode: ${e}`, "error");
    }
  }

  async function handleToggle(enabled: boolean) {
    try {
      await setDirEnabled(config.path, enabled);
      onRemoved();
    } catch (e) {
      showToast(`Failed to toggle dir: ${e}`, "error");
    }
  }

  async function handleScan() {
    setScanning(true);
    try {
      const count = await scanAndIndex(config.path);
      showToast(`Indexed ${count} files in ${config.path.split(/[\\/]/).pop()}`, "success");
      onRemoved();
    } catch (e) {
      showToast(`Scan failed: ${e}`, "error");
    } finally {
      setScanning(false);
    }
  }

  async function handleRemove() {
    try {
      // Try to unwatch (may fail if not actively watched)
      try {
        await unwatchDirectory(config.path);
      } catch { /* ignore - dir may not have been actively watched */ }
      // Always remove from capture config
      await removeDirectory(config.path);
      showToast(`Removed: ${config.path}`, "info");
      onRemoved();
    } catch (e) {
      showToast(`Failed to remove: ${e}`, "error");
    }
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--bg-inset)", border: "1px solid var(--border-default)" }}>
      <div className="flex items-center gap-3">
        <Toggle checked={config.enabled} onChange={handleToggle} size="sm" label={`Enable ${config.path}`} />
        <span className="flex-1 text-sm font-medium truncate" style={{ color: config.enabled ? "var(--text-primary)" : "var(--text-tertiary)" }} title={config.path}>
          {config.path}
        </span>
        <Button variant="secondary" onClick={handleScan} disabled={scanning} className="text-xs px-2 py-1 gap-1">
          <Scan size={12} /> {scanning ? "Scanning..." : "Scan"}
        </Button>
        <button
          onClick={handleRemove}
          aria-label="Remove directory"
          className="flex items-center justify-center rounded-lg p-1.5 transition-colors"
          style={{ color: "var(--text-tertiary)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Mode selector */}
      <div className="flex gap-1.5" role="tablist" aria-label="Capture mode">
        {MODES.map((m) => (
          <button
            key={m.value}
            role="tab"
            aria-selected={config.capture_mode === m.value}
            aria-pressed={config.capture_mode === m.value}
            onClick={() => handleModeChange(m.value)}
            className="flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: config.capture_mode === m.value ? "var(--accent-soft)" : "transparent",
              color: config.capture_mode === m.value ? "var(--accent)" : "var(--text-tertiary)",
              border: `1px solid ${config.capture_mode === m.value ? "var(--accent)" : "var(--border-default)"}`,
            }}
            title={m.description}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      {stats && (
        <div className="flex gap-4 text-xs" style={{ color: "var(--text-tertiary)" }}>
          <span>{stats.file_count.toLocaleString()} files</span>
          <span>{formatBytes(stats.disk_usage)}</span>
          <span>{stats.changes_per_minute.toFixed(1)}/min</span>
          {stats.last_triggered_rule && <span>Last: {stats.last_triggered_rule}</span>}
        </div>
      )}
    </div>
  );
}
