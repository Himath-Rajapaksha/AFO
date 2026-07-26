import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { watchDirectory, unwatchDirectory, listWatchedDirectories, createSchedule, listSchedules, deleteSchedule, toggleSchedule, runScheduleNow, type WatchedDir, type Schedule } from "../../lib/tauri-bridge";
import { useAppStore } from "../../lib/store";
import { showToast } from "../Toast";
import { Card, CardHeader, CardDescription, CardRow } from "../ui/Card";
import Button from "../ui/Button";
import Toggle from "../ui/Toggle";
import { ThemeToggle } from "../ui/ThemeToggle";
import { resetTutorial } from "../Tutorial";

const SECTION_IDS = ["general", "notifications", "privacy", "about"] as const;
type Section = (typeof SECTION_IDS)[number];

export default function SettingsPanel() {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<Section>("general");

  const sections: { id: Section; label: string }[] = [
    { id: "general", label: t("settings.general") },
    { id: "notifications", label: t("settings.notifications") },
    { id: "privacy", label: t("settings.privacy") },
    { id: "about", label: t("settings.about") },
  ];

  return (
    <div className="flex flex-col gap-5 p-6">
      <div><h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>{t("settings.title")}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{t("settings.description")}</p></div>
      <div className="flex gap-6">
        <nav className="w-48 shrink-0 space-y-1">
          {sections.map((s) => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors"
              style={{ backgroundColor: activeSection === s.id ? "var(--accent-soft)" : "transparent", color: activeSection === s.id ? "var(--accent)" : "var(--text-secondary)" }}>
              {s.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1">
          {activeSection === "general" && <GeneralSection />}
          {activeSection === "notifications" && <NotificationsSection />}
          {activeSection === "privacy" && <PrivacySection />}
          {activeSection === "about" && <AboutSection />}
        </div>
      </div>
    </div>
  );
}

function GeneralSection() {
  const { t } = useTranslation();
  const [watchedDirs, setWatchedDirs] = useState<WatchedDir[]>([]);
  const [loadingDirs, setLoadingDirs] = useState(true);
  const [newDir, setNewDir] = useState("");
  const setActivePanel = useAppStore((s) => s.setActivePanel);

  const refreshDirs = useCallback(async () => {
    try { setWatchedDirs(await listWatchedDirectories()); } catch { /* ignore */ } finally { setLoadingDirs(false); }
  }, []);
  useEffect(() => { refreshDirs(); }, [refreshDirs]);

  async function handleAddDir() {
    if (!newDir.trim()) return;
    try { await watchDirectory(newDir.trim()); setNewDir(""); await refreshDirs(); showToast(t("app.startedWatching"), "success"); } catch (e) { showToast(`Failed: ${e}`, "error"); }
  }
  async function handleRemoveDir(dir: string) {
    try { await unwatchDirectory(dir); await refreshDirs(); showToast(t("app.stoppedWatching"), "info"); } catch (e) { showToast(`Failed: ${e}`, "error"); }
  }
  async function handlePickDir() {
    try { const { open } = await import("@tauri-apps/plugin-dialog"); const sel = await open({ directory: true, multiple: false }); if (sel && typeof sel === "string") setNewDir(sel); } catch { showToast(t("app.pickerNotAvailable"), "error"); }
  }

  return (
    <div className="space-y-5">
      {/* Appearance */}
      <Card>
        <CardHeader>{t("settings.generalTitle")}</CardHeader>
        <CardRow label={t("settings.appearance")} description={t("settings.appearanceDesc")} control={
          <ThemeToggle />
        } />
        <CardRow label={t("settings.showTutorial")} description={t("settings.showTutorialDesc")} control={
          <Button variant="secondary" onClick={() => { resetTutorial(); setActivePanel("tutorial"); }} className="text-xs">{t("common.show")}</Button>
        } />
        <CardRow label={t("settings.recursiveScanDepth")} rightValue="5" />
        <CardRow label={t("settings.quarantineAutoDelete")} rightValue="30 days" />
        <CardRow label={t("settings.watchDebounce")} rightValue="300ms" />
      </Card>

      {/* Watched Directories */}
      <Card>
        <CardHeader>{t("settings.folderWatching")}</CardHeader>
        <CardDescription>{t("settings.folderWatchingDesc")}</CardDescription>
        <div className="flex items-center gap-2 mb-3">
          <Button variant="secondary" onClick={handlePickDir} className="text-xs">{t("common.browse")}</Button>
          <input type="text" value={newDir} onChange={(e) => setNewDir(e.target.value)} placeholder="/path/to/directory" onKeyDown={(e) => e.key === "Enter" && handleAddDir()} aria-label={t("aria.directoryPathToWatch")}
            className="flex-1 rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" style={{ backgroundColor: "var(--bg-inset)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />
          <Button onClick={handleAddDir} disabled={!newDir.trim()} className="text-xs">{t("common.add")}</Button>
        </div>
        {loadingDirs ? <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{t("common.loading")}</p> : watchedDirs.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{t("settings.noDirectoriesBeingWatched")}</p>
        ) : (
          <div className="space-y-1.5">
            {watchedDirs.map((dir) => (
              <div key={dir.path} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-inset)" }}>
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: dir.enabled ? "var(--success)" : "var(--text-tertiary)" }} />
                <span className="flex-1 truncate text-sm" style={{ color: "var(--text-primary)" }}>{dir.path}</span>
                <button onClick={() => handleRemoveDir(dir.path)} className="text-xs" style={{ color: "var(--danger)" }}>{t("common.remove")}</button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Schedules */}
      <SchedulesCard />
    </div>
  );
}

function SchedulesCard() {
  const { t } = useTranslation();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCron, setNewCron] = useState("");
  const [newAction, setNewAction] = useState("organize_extension");
  const [newPath, setNewPath] = useState("");

  const refresh = useCallback(async () => { try { setSchedules(await listSchedules()); } catch { /* */ } finally { setLoading(false); } }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function handleCreate() {
    if (!newName.trim() || !newCron.trim() || !newPath.trim()) return;
    try { await createSchedule(newName.trim(), newCron.trim(), newAction, newPath.trim()); setNewName(""); setNewCron(""); setNewPath(""); setShowCreate(false); await refresh(); showToast(t("app.scheduleCreated"), "success"); }
    catch (e) { showToast(`Failed: ${e}`, "error"); }
  }

  function getActionLabel(a: Schedule["action"]): string {
    if (a.OrganizeByExtension) return t("settings.organizeByExtension");
    if (a.OrganizeByDate) return t("settings.organizeByDate");
    if (a.ApplyRules) return t("settings.applyRules");
    if (a.ScanDuplicates) return t("settings.scanDuplicates");
    return "Unknown";
  }

  return (
    <Card>
      <CardHeader>{t("settings.schedules")}</CardHeader>
      <CardDescription>{t("settings.schedulesDesc")}</CardDescription>
      {!showCreate && <Button variant="secondary" onClick={() => setShowCreate(true)} aria-expanded="false" className="text-xs mb-3">{t("settings.createSchedule")}</Button>}
      {showCreate && (
        <div className="mb-3 rounded-lg p-3 space-y-2" style={{ backgroundColor: "var(--bg-inset)", border: "1px solid var(--border-default)" }}>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" aria-label={t("aria.scheduleName")} className="rounded-lg px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />
            <input type="text" value={newCron} onChange={(e) => setNewCron(e.target.value)} placeholder="Cron (0 9 * * *)" aria-label={t("aria.cronExpression")} className="rounded-lg px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={newAction} onChange={(e) => setNewAction(e.target.value)} aria-label={t("aria.scheduleAction")} className="rounded-lg px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}>
              <option value="organize_extension">{t("settings.organizeByExtension")}</option>
              <option value="organize_date">{t("settings.organizeByDate")}</option>
              <option value="apply_rules">{t("settings.applyRules")}</option>
              <option value="scan_duplicates">{t("settings.scanDuplicates")}</option>
            </select>
            <input type="text" value={newPath} onChange={(e) => setNewPath(e.target.value)} placeholder="/path/to/dir" aria-label={t("aria.scheduleDirectoryPath")} className="rounded-lg px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={!newName.trim() || !newCron.trim() || !newPath.trim()} className="text-xs">{t("common.save")}</Button>
            <Button variant="secondary" onClick={() => setShowCreate(false)} className="text-xs">{t("common.cancel")}</Button>
          </div>
        </div>
      )}
      {loading ? <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{t("common.loading")}</p> : schedules.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{t("settings.noSchedulesConfigured")}</p>
      ) : (
        <div className="space-y-1.5">
          {schedules.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-inset)", opacity: s.enabled ? 1 : 0.5 }}>
              <Toggle checked={s.enabled} onChange={async () => { await toggleSchedule(s.id, !s.enabled); await refresh(); }} size="sm" label={t("settings.enableSchedule", { name: s.name })} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{s.name}</div>
                <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{s.cron} · {getActionLabel(s.action)}</div>
              </div>
              <Button variant="secondary" onClick={async () => { await runScheduleNow(s.id); await refresh(); showToast(t("app.executed"), "success"); }} className="text-xs px-2 py-1">{t("common.run")}</Button>
              <button onClick={async () => { await deleteSchedule(s.id); await refresh(); }} className="text-xs" style={{ color: "var(--danger)" }}>{t("common.delete")}</button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function NotificationsSection() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<{ operationComplete: boolean; scheduledRun: boolean; errorAlerts: boolean; liveCapture: boolean }>(() => {
    try {
      const saved = localStorage.getItem("afo-notification-settings");
      return saved ? { operationComplete: true, scheduledRun: true, errorAlerts: true, liveCapture: true, ...JSON.parse(saved) } : { operationComplete: true, scheduledRun: true, errorAlerts: true, liveCapture: true };
    } catch { return { operationComplete: true, scheduledRun: true, errorAlerts: true, liveCapture: true }; }
  });

  function toggle(key: keyof typeof settings) {
    setSettings((prev: typeof settings) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("afo-notification-settings", JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>{t("settings.notificationsTitle")}</CardHeader>
        <CardDescription>{t("settings.notificationsDesc")}</CardDescription>
        <CardRow label={t("settings.operationComplete")} description={t("settings.operationCompleteDesc")} control={<Toggle checked={settings.operationComplete} onChange={() => toggle("operationComplete")} label={t("aria.operationCompleteNotifications")} />} />
        <CardRow label={t("settings.liveCapture")} description={t("settings.liveCaptureDesc")} control={<Toggle checked={settings.liveCapture} onChange={() => toggle("liveCapture")} label={t("aria.liveCaptureNotifications")} />} />
        <CardRow label={t("settings.scheduledRun")} description={t("settings.scheduledRunDesc")} control={<Toggle checked={settings.scheduledRun} onChange={() => toggle("scheduledRun")} label={t("aria.scheduledRunNotifications")} />} />
        <CardRow label={t("settings.errorAlerts")} description={t("settings.errorAlertsDesc")} control={<Toggle checked={settings.errorAlerts} onChange={() => toggle("errorAlerts")} label={t("aria.errorAlerts")} />} />
      </Card>
    </div>
  );
}

function PrivacySection() {
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>{t("settings.privacyTitle")}</CardHeader>
        <CardDescription>{t("settings.privacyDesc")}</CardDescription>
        <CardRow label={t("settings.usageAnalytics")} description={t("settings.usageAnalyticsDesc")} control={<Toggle checked={false} onChange={() => {}} disabled label={t("aria.usageAnalytics")} />} />
        <CardRow label={t("settings.logToFile")} description={t("settings.logToFileDesc")} control={<Toggle checked={true} onChange={() => {}} disabled label={t("aria.logToFile")} />} />
      </Card>
    </div>
  );
}

function AboutSection() {
  const { t } = useTranslation();

  async function openGitHub() {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open("https://github.com/Himath-Rajapaksha/AFO");
    } catch {
      window.open("https://github.com/Himath-Rajapaksha/AFO", "_blank");
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>{t("settings.aboutAFO")}</CardHeader>
        <CardDescription>{t("settings.advancedFileOrganizer")}</CardDescription>
        <CardRow label={t("settings.version")} rightValue="3.3.1-beta" />
        <CardRow label={t("settings.build")} rightValue="2026-07-21" />
        <CardRow label={t("settings.engine")} rightValue="Tauri v2 + Rust" />
        <CardRow label={t("settings.license")} rightValue="MIT" />
      </Card>
      <Card>
        <Button variant="secondary" onClick={openGitHub} className="gap-2">
          <svg viewBox="0 0 24 24" fill="currentColor" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.001 2C6.47598 2 2.00098 6.475 2.00098 12C2.00098 16.425 4.86348 20.1625 8.83848 21.4875C9.33848 21.575 9.52598 21.275 9.52598 21.0125C9.52598 20.775 9.51348 19.9875 9.51348 19.15C7.00098 19.6125 6.35098 18.5375 6.15098 17.975C6.03848 17.6875 5.55098 16.8 5.12598 16.5625C4.77598 16.375 4.27598 15.9125 5.11348 15.9C5.90098 15.8875 6.46348 16.625 6.65098 16.925C7.55098 18.4375 8.98848 18.0125 9.56348 17.75C9.65098 17.1 9.91348 16.6625 10.201 16.4125C7.97598 16.1625 5.65098 15.3 5.65098 11.475C5.65098 10.3875 6.03848 9.4875 6.67598 8.7875C6.57598 8.5375 6.22598 7.5125 6.77598 6.1375C6.77598 6.1375 7.61348 5.875 9.52598 7.1625C10.326 6.9375 11.176 6.825 12.026 6.825C12.876 6.825 13.726 6.9375 14.526 7.1625C16.4385 5.8625 17.276 6.1375 17.276 6.1375C17.826 7.5125 17.476 8.5375 17.376 8.7875C18.0135 9.4875 18.401 10.375 18.401 11.475C18.401 15.3125 16.0635 16.1625 13.8385 16.4125C14.201 16.725 14.5135 17.325 14.5135 18.2625C14.5135 19.6 14.501 20.675 14.501 21.0125C14.501 21.275 14.6885 21.5875 15.1885 21.4875C19.259 20.1133 21.9999 16.2963 22.001 12C22.001 6.475 17.526 2 12.001 2Z" />
          </svg>
          GitHub
        </Button>
      </Card>
      <Card>
        <CardHeader>{t("settings.dataLocations")}</CardHeader>
        <div className="space-y-1.5 font-mono text-xs" style={{ color: "var(--text-tertiary)" }}>
          <CardRow label={t("settings.config")} rightValue="~/.config/afo/" />
          <CardRow label={t("settings.journal")} rightValue="~/.local/share/afo/" />
          <CardRow label={t("settings.logs")} rightValue="~/.local/share/afo/afo.log" />
        </div>
      </Card>
    </div>
  );
}
