import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { FolderOpen, GitBranch, Copy, HardDrive, History, Settings, Radio, BookOpen, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useAppStore, type Panel } from "../../lib/store";
import logo from "../../assets/logo.png";

const NAV_ITEMS: { id: Panel; labelKey: string; icon: typeof FolderOpen; cssVar: string }[] = [
  { id: "organize", labelKey: "sidebar.organize", icon: FolderOpen, cssVar: "--icon-organize" },
  { id: "capture", labelKey: "sidebar.capture", icon: Radio, cssVar: "--icon-capture" },
  { id: "rules", labelKey: "sidebar.rules", icon: GitBranch, cssVar: "--icon-rules" },
  { id: "duplicates", labelKey: "sidebar.duplicates", icon: Copy, cssVar: "--icon-duplicates" },
  { id: "storage", labelKey: "sidebar.storage", icon: HardDrive, cssVar: "--icon-storage" },
  { id: "history", labelKey: "sidebar.history", icon: History, cssVar: "--icon-history" },
  { id: "tutorial", labelKey: "sidebar.tutorial", icon: BookOpen, cssVar: "--icon-tutorial" },
  { id: "settings", labelKey: "sidebar.settings", icon: Settings, cssVar: "--icon-settings" },
];

const STORAGE_KEY = "afo-sidebar-collapsed";
const EXPANDED_W = 240; // w-60
const COLLAPSED_W = 60;  // enough for 28px icon + padding

function readCollapsed(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
}

export default function Sidebar() {
  const { t } = useTranslation();
  const activePanel = useAppStore((s) => s.activePanel);
  const setActivePanel = useAppStore((s) => s.setActivePanel);
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(collapsed)); } catch { /* ignore */ }
  }, [collapsed]);

  const width = collapsed ? COLLAPSED_W : EXPANDED_W;

  return (
    <motion.aside
      animate={{ width }}
      transition={{ type: "spring", bounce: 0.12, duration: 0.35 }}
      className="flex shrink-0 flex-col border-r py-4 overflow-hidden"
      style={{
        backgroundColor: "var(--bg-sidebar)",
        borderColor: "var(--border-default)",
      }}
    >
      {/* Logo */}
      <div className={`mb-8 flex items-center ${collapsed ? "justify-center px-0" : "gap-3 px-5"}`}>
        <img
          src={logo}
          alt="AFO"
          className="h-9 w-9 rounded-[10px] object-cover shrink-0"
        />
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="text-sm font-bold whitespace-nowrap overflow-hidden"
              style={{ color: "var(--text-primary)" }}
            >
              AFO
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="relative flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => {
          const active = activePanel === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActivePanel(item.id)}
              aria-current={active ? "page" : undefined}
              title={collapsed ? t(item.labelKey) : undefined}
              className={`group relative flex w-full items-center rounded-lg text-left text-sm transition-colors ${
                collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
              }`}
              style={{
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg"
                  style={{
                    backgroundColor: "var(--accent-soft)",
                  }}
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `var(${item.cssVar})` }}>
                <Icon size={16} style={{ color: `var(${item.cssVar}-fg)` }} strokeWidth={1.8} />
              </span>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="relative z-10 truncate font-medium whitespace-nowrap overflow-hidden"
                  >
                    {t(item.labelKey)}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle + version footer */}
      <div className="pt-4" style={{ borderTop: "1px solid var(--border-default)" }}>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={`flex w-full items-center text-xs transition-colors ${
            collapsed ? "justify-center px-0 py-1.5" : "gap-2 px-5 py-1.5"
          }`}
          style={{ color: "var(--text-tertiary)" }}
          title={collapsed ? t('sidebar.expandSidebar') : t('sidebar.collapseSidebar')}
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="whitespace-nowrap overflow-hidden"
              >
                {t('sidebar.version')}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}
