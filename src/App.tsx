import { useCallback, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "./lib/store";
import { ThemeProvider } from "./lib/ThemeProvider";
import Sidebar from "./components/Sidebar";
import OrganizePanel from "./components/OrganizePanel";
import LiveCapturePanel from "./components/LiveCapture";
import RuleBuilder from "./components/RuleBuilder";
import DuplicatesPanel from "./components/DuplicatesPanel";
import StoragePanel from "./components/StoragePanel";
import HistoryPanel from "./components/HistoryPanel";
import SettingsPanel from "./components/SettingsPanel";
import TutorialPanel from "./components/TutorialPanel";
import CommandPalette from "./components/CommandPalette";
import ToastContainer, { showToast } from "./components/Toast";
import DropZone from "./components/DropZone";
import UpdateProvider from "./components/UpdateProvider";
import { shouldShowTutorial } from "./components/Tutorial";

const panels = {
  organize: OrganizePanel,
  capture: LiveCapturePanel,
  rules: RuleBuilder,
  duplicates: DuplicatesPanel,
  storage: StoragePanel,
  history: HistoryPanel,
  settings: SettingsPanel,
  tutorial: TutorialPanel,
} as const;

function ActivePanel() {
  const activePanel = useAppStore((s) => s.activePanel);
  const Panel = panels[activePanel];

  return (
    <div className="relative h-full">
      <div className="absolute inset-0 h-full overflow-y-auto">
        <Panel />
      </div>
    </div>
  );
}

export default function App() {
  const setActivePanel = useAppStore((s) => s.setActivePanel);
  const setDroppedPaths = useAppStore((s) => s.setDroppedPaths);

  // Show tutorial on first launch
  useEffect(() => {
    if (shouldShowTutorial()) {
      setActivePanel("tutorial");
    }
  }, [setActivePanel]);

  const handleFilesDropped = useCallback(
    (paths: string[]) => {
      setDroppedPaths(paths);
      setActivePanel("organize");
    },
    [setDroppedPaths, setActivePanel],
  );

  useEffect(() => {
    // Helper: read live notification toggle from localStorage (matches Settings > Notifications pattern)
    function isLiveCaptureEnabled(): boolean {
      try {
        const saved = localStorage.getItem("afo-notification-settings");
        if (saved) {
          const s = JSON.parse(saved);
          return s.liveCapture !== false; // default true
        }
      } catch { /* ignore */ }
      return true;
    }

    const unlistenActivity = listen<{ type: string; source: string; destination?: string; rule?: string }>(
      "afo://activity",
      (event) => {
        const { type, source, destination, rule } = event.payload;
        const filename = source.split(/[\\/]/).pop() || source;
        if (type === "move" && destination) {
          const destName = destination.split(/[\\/]/).pop() || destination;
          showToast(`Moved "${filename}" → "${destName}"${rule ? ` by rule "${rule}"` : ""}`, "success");
        } else {
          showToast(`${type}: ${filename}`, "info");
        }
      },
    );

    // Single event handler for all Live Capture file changes (consolidated)
    // Replaces the separate afo://pending-action listener to prevent double-toasts.
    const unlistenFileChange = listen<{ source: string; filename?: string; watched_dir?: string; change_type?: string }>(
      "afo://file_change",
      (event) => {
        if (!isLiveCaptureEnabled()) return;
        const { filename, change_type } = event.payload;
        const name = filename || event.payload.source.split(/[\\/]/).pop() || event.payload.source;
        const label = change_type === "pending" ? "Pending approval" :
                      change_type === "captured" ? "Captured" :
                      change_type === "auto_organize" ? "Auto-organized" : "File change";
        showToast(`${label}: "${name}"`, "info");
      },
    );

    return () => {
      unlistenActivity.then((fn) => fn());
      unlistenFileChange.then((fn) => fn());
    };
  }, []);

  return (
    <ThemeProvider>
      <div className="flex h-screen w-screen overflow-hidden" style={{ background: "var(--bg-app)", color: "var(--text-primary)" }}>
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <ActivePanel />
        </main>
        <DropZone onFilesDropped={handleFilesDropped} />
        <CommandPalette />
        <ToastContainer />
        <UpdateProvider />
      </div>
    </ThemeProvider>
  );
}
