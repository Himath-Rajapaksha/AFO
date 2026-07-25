import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, Trash2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { showToast } from "../Toast";
import { Card, CardHeader, CardDescription } from "../ui/Card";
import Button from "../ui/Button";
import { getSystemDisks, type DiskInfo } from "../../lib/tauri-bridge";
import { StorageBar, formatBytes, type StorageSegment } from "../ui/StorageBar";
import folderIcon from "../../assets/folder-icon.png";
import driveIcon from "../../assets/drive-icon.png";

interface CategoryBreakdown {
  label: string;
  bytes: number;
}

interface StorageBreakdownResult {
  directory: string;
  totalScannedBytes: number;
  categories: CategoryBreakdown[];
  totalSpace: number;
  availableSpace: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  Images: "#ff3b30",
  Documents: "#0071E3",
  Audio: "#af52de",
  Video: "#ff9500",
  Archives: "#34c759",
  Code: "#5856d6",
  Other: "#aeaeb2",
};

const CUSTOM_DIRS_KEY = "afo-custom-storage-dirs";

function formatCapacity(bytes: number): string {
  if (bytes === 0) return "0 GB";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1000) {
    return `${(gb / 1000).toFixed(0)} TB`;
  }
  return `${gb.toFixed(0)} GB`;
}

// ── Storage Card (shared by disks and custom dirs) ──────────────────

interface StorageCardProps {
  name: string;
  mountPoint: string;
  totalSpace: number;
  availableSpace: number;
  isRemovable: boolean;
  breakdown: StorageBreakdownResult | null;
  loading: boolean;
  onScan: (dir: string) => void;
  onRemove?: () => void;
}

function StorageCard({ name, mountPoint, totalSpace: propTotalSpace, availableSpace: propAvailableSpace, isRemovable, breakdown, loading, onScan, onRemove }: StorageCardProps) {
  const { t } = useTranslation();
  // Use breakdown's disk space if available (for custom dirs), otherwise use props
  const totalSpace = breakdown?.totalSpace || propTotalSpace;
  const availableSpace = breakdown?.availableSpace || propAvailableSpace;
  const usedSpace = totalSpace - availableSpace;
  const usagePercent = totalSpace > 0 ? (usedSpace / totalSpace) * 100 : 0;

  const segments: StorageSegment[] = breakdown?.categories
    .filter((c) => c.bytes > 0)
    .map((c) => ({
      label: c.label,
      bytes: c.bytes,
      color: CATEGORY_COLORS[c.label] ?? "#aeaeb2",
    })) ?? [];

  return (
    <div className="flex gap-5 rounded-xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }}>
      {/* Drive icon */}
      <div className="flex flex-col items-center gap-2 shrink-0">
        <img
          src={isRemovable ? driveIcon : folderIcon}
          alt=""
          className="h-16 w-16 object-contain"
        />
        <div className="text-center">
          <div className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
            {formatCapacity(totalSpace)}
          </div>
          <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            {isRemovable ? t("storage.external") : t("storage.storage")}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
            {name}
          </span>
          <span className="text-xs shrink-0 ml-2" style={{ color: "var(--text-secondary)" }}>
            {breakdown
              ? `${formatBytes(breakdown.totalScannedBytes)} ${t("storage.scanned")}`
              : `${formatBytes(availableSpace)} ${t("storage.freeOf", { capacity: formatCapacity(totalSpace) })}`}
          </span>
        </div>

        {/* Usage bar */}
        {breakdown ? (
          <>
            <StorageBar segments={segments} totalBytes={breakdown.totalScannedBytes} />
            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {segments.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5 text-[11px]">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                  <span style={{ color: "var(--text-primary)" }}>{s.label}</span>
                  <span style={{ color: "var(--text-tertiary)" }}>{formatBytes(s.bytes)}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="h-4 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border-default)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${usagePercent}%`,
                  backgroundColor: "var(--accent)",
                }}
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                {formatBytes(usedSpace)} {t("storage.used")}
              </span>
              <Button
                variant="secondary"
                onClick={() => onScan(mountPoint)}
                disabled={loading}
                className="text-[10px] px-2 py-0.5 ml-auto"
              >
                {loading ? t("common.scanning") : t("common.scan")}
              </Button>
              {onRemove && (
                <button
                  onClick={onRemove}
                  className="p-1 rounded transition-colors"
                  style={{ color: "var(--text-tertiary)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
                  title={t("storage.remove")}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Panel ──────────────────────────────────────────────────────

export default function StoragePanel() {
  const { t } = useTranslation();
  const [disks, setDisks] = useState<DiskInfo[]>([]);
  const [customDirs, setCustomDirs] = useState<string[]>([]);
  const [breakdowns, setBreakdowns] = useState<Record<string, StorageBreakdownResult>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [loadingDisks, setLoadingDisks] = useState(true);
  const [newDir, setNewDir] = useState("");

  useEffect(() => {
    loadDisks();
    loadCustomDirs();
  }, []);

  async function loadDisks() {
    try {
      const diskList = await getSystemDisks();
      setDisks(diskList);
    } catch (e) {
      showToast(t("app.failedToLoadDisks", { error: e }), "error");
    } finally {
      setLoadingDisks(false);
    }
  }

  function loadCustomDirs() {
    try {
      const saved = localStorage.getItem(CUSTOM_DIRS_KEY);
      if (saved) setCustomDirs(JSON.parse(saved));
    } catch { /* ignore */ }
  }

  function saveCustomDirs(dirs: string[]) {
    setCustomDirs(dirs);
    localStorage.setItem(CUSTOM_DIRS_KEY, JSON.stringify(dirs));
  }

  async function handleAddDir() {
    const dir = newDir.trim();
    if (!dir) return;
    if (customDirs.includes(dir)) {
      showToast(t("app.directoryAlreadyAdded"), "info");
      return;
    }
    saveCustomDirs([...customDirs, dir]);
    setNewDir("");
    showToast(t("app.added", { dir }), "success");
  }

  async function handlePickDir() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === "string") {
        setNewDir(selected);
      }
    } catch (e) {
      showToast(t("app.directoryPickerFailed", { error: e }), "error");
    }
  }

  function handleRemoveDir(dir: string) {
    saveCustomDirs(customDirs.filter((d) => d !== dir));
    // Also remove breakdown
    setBreakdowns((prev) => {
      const next = { ...prev };
      delete next[dir];
      return next;
    });
    showToast(t("app.removed", { dir }), "info");
  }

  async function handleScan(dir: string) {
    setLoading((prev) => ({ ...prev, [dir]: true }));
    try {
      const data = await invoke<StorageBreakdownResult>("scan_storage_breakdown", {
        directory: dir,
      });
      setBreakdowns((prev) => ({ ...prev, [dir]: data }));
    } catch (e) {
      showToast(t("app.scanFailed", { error: e }), "error");
    } finally {
      setLoading((prev) => ({ ...prev, [dir]: false }));
    }
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          {t("storage.title")}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          {t("storage.description")}
        </p>
      </div>

      {/* Source input */}
      <Card>
        <CardHeader>{t("storage.source")}</CardHeader>
        <CardDescription>{t("storage.sourceDesc")}</CardDescription>
        <div className="flex items-center gap-2 mt-2">
          <Button variant="secondary" onClick={handlePickDir} className="gap-1 text-xs">
            <FolderOpen size={12} /> {t("storage.chooseDirectory")}
          </Button>
          <input
            type="text"
            value={newDir}
            onChange={(e) => setNewDir(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddDir()}
            placeholder="/path/to/directory"
            className="flex-1 rounded-lg px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            style={{ backgroundColor: "var(--bg-inset)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
          />
          <Button onClick={handleAddDir} disabled={!newDir.trim()} className="text-xs">{t("storage.add")}</Button>
        </div>
      </Card>

      {/* System drives */}
      {loadingDisks ? (
        <Card>
          <p className="text-sm text-center py-4" style={{ color: "var(--text-tertiary)" }}>
            {t("storage.loadingDisks")}
          </p>
        </Card>
      ) : disks.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            {t("storage.systemDrives")}
          </h3>
          {disks.map((disk) => (
            <StorageCard
              key={disk.mount_point}
              name={disk.name || disk.mount_point}
              mountPoint={disk.mount_point}
              totalSpace={disk.total_space}
              availableSpace={disk.available_space}
              isRemovable={disk.is_removable}
              breakdown={breakdowns[disk.mount_point] || null}
              loading={loading[disk.mount_point] || false}
              onScan={handleScan}
            />
          ))}
        </div>
      )}

      {/* Custom directories */}
      {customDirs.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            {t("storage.customDirectories")}
          </h3>
          {customDirs.map((dir) => (
            <StorageCard
              key={dir}
              name={dir}
              mountPoint={dir}
              totalSpace={0}
              availableSpace={0}
              isRemovable={false}
              breakdown={breakdowns[dir] || null}
              loading={loading[dir] || false}
              onScan={handleScan}
              onRemove={() => handleRemoveDir(dir)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
