import { useState, useEffect, useCallback } from "react";
import { watchDirectory, unwatchDirectory, listWatchedDirectories, createSchedule, listSchedules, deleteSchedule, toggleSchedule, runScheduleNow, type WatchedDir, type Schedule } from "../../lib/tauri-bridge";
import { useAppStore } from "../../lib/store";
import { showToast } from "../Toast";
import { Card, CardHeader, CardDescription, CardRow } from "../ui/Card";
import Button from "../ui/Button";
import Toggle from "../ui/Toggle";
import { ThemeToggle } from "../ui/ThemeToggle";
import { resetTutorial } from "../Tutorial";

const SECTIONS = [
  { id: "general", label: "General" },
  { id: "notifications", label: "Notifications" },
  { id: "privacy", label: "Privacy" },
  { id: "about", label: "About" },
] as const;

type Section = (typeof SECTIONS)[number]["id"];

export default function SettingsPanel() {
  const [activeSection, setActiveSection] = useState<Section>("general");

  return (
    <div className="flex flex-col gap-5 p-6">
      <div><h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Settings</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Application settings and configuration.</p></div>
      <div className="flex gap-6">
        <nav className="w-48 shrink-0 space-y-1">
          {SECTIONS.map((s) => (
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
    try { await watchDirectory(newDir.trim()); setNewDir(""); await refreshDirs(); showToast("Started watching directory", "success"); } catch (e) { showToast(`Failed: ${e}`, "error"); }
  }
  async function handleRemoveDir(dir: string) {
    try { await unwatchDirectory(dir); await refreshDirs(); showToast("Stopped watching", "info"); } catch (e) { showToast(`Failed: ${e}`, "error"); }
  }
  async function handlePickDir() {
    try { const { open } = await import("@tauri-apps/plugin-dialog"); const sel = await open({ directory: true, multiple: false }); if (sel && typeof sel === "string") setNewDir(sel); } catch { showToast("Picker not available", "error"); }
  }

  return (
    <div className="space-y-5">
      {/* Appearance */}
      <Card>
        <CardHeader>General</CardHeader>
        <CardRow label="Appearance" description="Switch between light and dark theme" control={
          <ThemeToggle />
        } />
        <CardRow label="Show Tutorial" description="Re-open the getting started guide" control={
          <Button variant="secondary" onClick={() => { resetTutorial(); setActivePanel("tutorial"); }} className="text-xs">Show</Button>
        } />
        <CardRow label="Recursive scan depth" rightValue="5" />
        <CardRow label="Quarantine auto-delete" rightValue="30 days" />
        <CardRow label="Watch debounce" rightValue="300ms" />
      </Card>

      {/* Watched Directories */}
      <Card>
        <CardHeader>Folder Watching</CardHeader>
        <CardDescription>Configure directories for real-time file watching.</CardDescription>
        <div className="flex items-center gap-2 mb-3">
          <Button variant="secondary" onClick={handlePickDir} className="text-xs">Browse</Button>
          <input type="text" value={newDir} onChange={(e) => setNewDir(e.target.value)} placeholder="/path/to/directory" onKeyDown={(e) => e.key === "Enter" && handleAddDir()}
            className="flex-1 rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" style={{ backgroundColor: "var(--bg-inset)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />
          <Button onClick={handleAddDir} disabled={!newDir.trim()} className="text-xs">Add</Button>
        </div>
        {loadingDirs ? <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Loading...</p> : watchedDirs.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>No directories being watched.</p>
        ) : (
          <div className="space-y-1.5">
            {watchedDirs.map((dir) => (
              <div key={dir.path} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-inset)" }}>
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: dir.enabled ? "var(--success)" : "var(--text-tertiary)" }} />
                <span className="flex-1 truncate text-sm" style={{ color: "var(--text-primary)" }}>{dir.path}</span>
                <button onClick={() => handleRemoveDir(dir.path)} className="text-xs" style={{ color: "var(--danger)" }}>Remove</button>
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
    try { await createSchedule(newName.trim(), newCron.trim(), newAction, newPath.trim()); setNewName(""); setNewCron(""); setNewPath(""); setShowCreate(false); await refresh(); showToast("Schedule created", "success"); }
    catch (e) { showToast(`Failed: ${e}`, "error"); }
  }

  function getActionLabel(a: Schedule["action"]): string {
    if (a.OrganizeByExtension) return "Organize by Extension";
    if (a.OrganizeByDate) return "Organize by Date";
    if (a.ApplyRules) return "Apply Rules";
    if (a.ScanDuplicates) return "Scan Duplicates";
    return "Unknown";
  }

  return (
    <Card>
      <CardHeader>Schedules</CardHeader>
      <CardDescription>Cron-based automated organization tasks.</CardDescription>
      {!showCreate && <Button variant="secondary" onClick={() => setShowCreate(true)} className="text-xs mb-3">Create Schedule</Button>}
      {showCreate && (
        <div className="mb-3 rounded-lg p-3 space-y-2" style={{ backgroundColor: "var(--bg-inset)", border: "1px solid var(--border-default)" }}>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" className="rounded-lg px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />
            <input type="text" value={newCron} onChange={(e) => setNewCron(e.target.value)} placeholder="Cron (0 9 * * *)" className="rounded-lg px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={newAction} onChange={(e) => setNewAction(e.target.value)} className="rounded-lg px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}>
              <option value="organize_extension">Organize by Extension</option>
              <option value="organize_date">Organize by Date</option>
              <option value="apply_rules">Apply Rules</option>
              <option value="scan_duplicates">Scan Duplicates</option>
            </select>
            <input type="text" value={newPath} onChange={(e) => setNewPath(e.target.value)} placeholder="/path/to/dir" className="rounded-lg px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={!newName.trim() || !newCron.trim() || !newPath.trim()} className="text-xs">Save</Button>
            <Button variant="secondary" onClick={() => setShowCreate(false)} className="text-xs">Cancel</Button>
          </div>
        </div>
      )}
      {loading ? <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Loading...</p> : schedules.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>No schedules configured.</p>
      ) : (
        <div className="space-y-1.5">
          {schedules.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-inset)", opacity: s.enabled ? 1 : 0.5 }}>
              <Toggle checked={s.enabled} onChange={async () => { await toggleSchedule(s.id, !s.enabled); await refresh(); }} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{s.name}</div>
                <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{s.cron} · {getActionLabel(s.action)}</div>
              </div>
              <Button variant="secondary" onClick={async () => { await runScheduleNow(s.id); await refresh(); showToast("Executed", "success"); }} className="text-xs px-2 py-1">Run</Button>
              <button onClick={async () => { await deleteSchedule(s.id); await refresh(); }} className="text-xs" style={{ color: "var(--danger)" }}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function NotificationsSection() {
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
        <CardHeader>Notifications</CardHeader>
        <CardDescription>Configure when and how you receive notifications.</CardDescription>
        <CardRow label="Operation Complete" description="Toast when organize/rename finishes" control={<Toggle checked={settings.operationComplete} onChange={() => toggle("operationComplete")} />} />
        <CardRow label="Live Capture" description="Toast on file changes in watched directories" control={<Toggle checked={settings.liveCapture} onChange={() => toggle("liveCapture")} />} />
        <CardRow label="Scheduled Run" description="Notify on cron job completion" control={<Toggle checked={settings.scheduledRun} onChange={() => toggle("scheduledRun")} />} />
        <CardRow label="Error Alerts" description="Show errors immediately" control={<Toggle checked={settings.errorAlerts} onChange={() => toggle("errorAlerts")} />} />
      </Card>
    </div>
  );
}

function PrivacySection() {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>Privacy</CardHeader>
        <CardDescription>Control data collection and storage.</CardDescription>
        <CardRow label="Usage Analytics" description="Not yet implemented" control={<Toggle checked={false} onChange={() => {}} disabled />} />
        <CardRow label="Log to File" description="Write operation logs to disk (always enabled)" control={<Toggle checked={true} onChange={() => {}} disabled />} />
      </Card>
    </div>
  );
}

function AboutSection() {
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
        <CardHeader>About AFO</CardHeader>
        <CardDescription>Advanced File Organizer</CardDescription>
        <CardRow label="Version" rightValue="3.1.1" />
        <CardRow label="Build" rightValue="2026-07-21" />
        <CardRow label="Engine" rightValue="Tauri v2 + Rust" />
        <CardRow label="License" rightValue="MIT" />
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
        <CardHeader>Data Locations</CardHeader>
        <div className="space-y-1.5 font-mono text-xs" style={{ color: "var(--text-tertiary)" }}>
          <CardRow label="Config" rightValue="~/.config/afo/" />
          <CardRow label="Journal" rightValue="~/.local/share/afo/" />
          <CardRow label="Logs" rightValue="~/.local/share/afo/afo.log" />
        </div>
      </Card>
    </div>
  );
}
