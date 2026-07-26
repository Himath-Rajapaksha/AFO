import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { X, Download, RefreshCw } from "lucide-react";

interface UpdateInfo {
  version: string;
  date?: string;
  body?: string;
}

export default function UpdateProvider() {
  const { t } = useTranslation();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem("afo:update-dismissed") === "true";
  });

  const checkForUpdates = useCallback(async () => {
    try {
      const update = await check();
      if (update) {
        setUpdateInfo({
          version: update.version,
          date: update.date,
          body: update.body,
        });
      }
    } catch (e) {
      console.error("Update check failed:", e);
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    checkForUpdates();
    const interval = setInterval(checkForUpdates, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkForUpdates]);

  useEffect(() => {
    if (dismissed || !updateInfo) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleDismiss();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dismissed, updateInfo]);

  async function handleDownload() {
    if (!updateInfo) return;
    setDownloading(true);
    setProgress(0);
    setError("");
    try {
      const update = await check();
      if (update) {
        await update.downloadAndInstall((event) => {
          if (event.event === "Started") {
            setProgress(0);
          } else if (event.event === "Progress") {
            setProgress((prev) => Math.min(prev + 10, 90));
          } else if (event.event === "Finished") {
            setProgress(100);
          }
        });
        await relaunch();
      }
    } catch (e) {
      setError(String(e));
      setDownloading(false);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem("afo:update-dismissed", "true");
  }

  if (dismissed || !updateInfo) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 z-50 rounded-xl p-4 shadow-lg"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        minWidth: 320,
        maxWidth: 400,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <RefreshCw size={16} style={{ color: "var(--success)" }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {t("update.updateAvailable")}
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              AFO {updateInfo.version}
              {updateInfo.date && ` — ${new Date(updateInfo.date).toLocaleDateString()}`}
            </p>
          </div>
        </div>
        <button onClick={handleDismiss} aria-label={t("aria.dismissUpdateNotification")} style={{ color: "var(--text-tertiary)" }}>
          <X size={14} />
        </button>
      </div>

      {updateInfo.body && (
        <p className="mt-2 text-xs max-h-20 overflow-y-auto" style={{ color: "var(--text-tertiary)" }}>
          {updateInfo.body}
        </p>
      )}

      {error && (
        <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      {downloading ? (
        <div className="mt-3">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-inset)" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, backgroundColor: "var(--success)" }}
            />
          </div>
          <p className="text-[10px] mt-1" style={{ color: "var(--text-tertiary)" }}>
            {progress < 100 ? t("update.downloading", { progress }) : t("update.installing")}
          </p>
        </div>
      ) : (
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            <Download size={12} /> {t("update.installUpdate")}
          </button>
          <button
            onClick={handleDismiss}
            className="rounded-lg px-3 py-1.5 text-xs transition-colors"
            style={{ backgroundColor: "var(--bg-inset)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}
          >
            {t("update.skip")}
          </button>
        </div>
      )}
    </div>
  );
}
