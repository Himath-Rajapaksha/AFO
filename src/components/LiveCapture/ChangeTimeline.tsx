import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { type FileChange, getRecentChanges } from "../../lib/tauri-bridge";

const CHANGE_COLORS: Record<string, string> = {
  create: "var(--success)",
  modify: "var(--info)",
  delete: "var(--danger)",
  move: "var(--warning)",
  pending_move: "var(--text-tertiary)",
};

export default function ChangeTimeline() {
  const { t } = useTranslation("capture");
  const [changes, setChanges] = useState<FileChange[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getRecentChanges(undefined, 60);
      setChanges(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (loading) {
    return <p className="text-xs text-center py-4" style={{ color: "var(--text-tertiary)" }}>{t("loadingChanges")}</p>;
  }

  if (changes.length === 0) {
    return <p className="text-xs text-center py-4" style={{ color: "var(--text-tertiary)" }}>{t("noChangesLastHour")}</p>;
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {changes.map((change) => {
        const filename = change.file_path.split(/[\\/]/).pop() || change.file_path;
        const color = CHANGE_COLORS[change.change_type] || "var(--text-tertiary)";
        return (
          <div key={change.id} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-inset)" }}>
            <span className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <div className="min-w-0 flex-1">
              <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{filename}</span>
              <span className="text-[10px] ml-2" style={{ color }}>{change.change_type}</span>
            </div>
            <span className="text-[10px] shrink-0" style={{ color: "var(--text-tertiary)" }}>
              {new Date(change.timestamp).toLocaleTimeString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
