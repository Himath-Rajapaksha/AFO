import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useAppStore, type Panel } from "../../lib/store";
import { undoLast, redoLast } from "../../lib/tauri-bridge";
import { showToast } from "../Toast";

// ── Types ──────────────────────────────────────────────

interface PaletteCommand {
  id: string;
  label: string;
  category: string;
  action: () => void;
  keywords: string[];
}

// ── Hook: open state ───────────────────────────────────

let externalOpen: (() => void) | null = null;

/** Allow other components to open the palette by importing this. */
export function openCommandPalette() {
  externalOpen?.();
}

// ── Component ──────────────────────────────────────────

export default function CommandPalette() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const setActivePanel = useAppStore((s) => s.setActivePanel);

  const openPalette = useCallback(() => {
    setQuery("");
    setActiveIndex(0);
    setVisibleCount(0);
    setOpen(true);
  }, []);

  // Register external opener
  useEffect(() => {
    externalOpen = openPalette;
    return () => {
      externalOpen = null;
    };
  }, [openPalette]);

  // ── Global key listener ──────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) {
          setOpen(false);
        } else {
          openPalette();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, openPalette]);

  // ── Commands ─────────────────────────────────────────

  const navigate = useCallback(
    (panel: Panel) => {
      setActivePanel(panel);
      setOpen(false);
    },
    [setActivePanel],
  );

  const commands: PaletteCommand[] = useMemo(
    () => [
      {
        id: "nav-organize",
        label: t("commandPalette.goToOrganize"),
        category: t("commandPalette.navigate"),
        action: () => navigate("organize"),
        keywords: ["organize", "files", "panel"],
      },
      {
        id: "nav-rules",
        label: t("commandPalette.goToRuleBuilder"),
        category: t("commandPalette.navigate"),
        action: () => navigate("rules"),
        keywords: ["rules", "builder", "automation"],
      },
      {
        id: "nav-duplicates",
        label: t("commandPalette.goToDuplicates"),
        category: t("commandPalette.navigate"),
        action: () => navigate("duplicates"),
        keywords: ["duplicates", "dups", "copy"],
      },
      {
        id: "nav-history",
        label: t("commandPalette.goToHistory"),
        category: t("commandPalette.navigate"),
        action: () => navigate("history"),
        keywords: ["history", "undo", "log"],
      },
      {
        id: "nav-settings",
        label: t("commandPalette.goToSettings"),
        category: t("commandPalette.navigate"),
        action: () => navigate("settings"),
        keywords: ["settings", "preferences", "config"],
      },
      {
        id: "nav-capture",
        label: t("commandPalette.goToLiveCapture"),
        category: t("commandPalette.navigate"),
        action: () => navigate("capture"),
        keywords: ["capture", "live", "watch", "monitor"],
      },
      {
        id: "action-undo",
        label: t("commandPalette.undoLastOperation"),
        category: t("commandPalette.actions"),
        action: async () => {
          setOpen(false);
          try {
            const entry = await undoLast();
            if (entry) showToast(`Undid ${entry.operation_type}`, "success");
            else showToast(t("commandPalette.nothingToUndo"), "info");
          } catch (e) { showToast(`${t("common.undo")} failed: ${e}`, "error"); }
        },
        keywords: ["undo", "revert", "back"],
      },
      {
        id: "action-redo",
        label: t("commandPalette.redoLastOperation"),
        category: t("commandPalette.actions"),
        action: async () => {
          setOpen(false);
          try {
            const entry = await redoLast();
            if (entry) showToast(`Redid ${entry.operation_type}`, "success");
            else showToast(t("commandPalette.nothingToRedo"), "info");
          } catch (e) { showToast(`Redo failed: ${e}`, "error"); }
        },
        keywords: ["redo", "forward"],
      },
    ],
    [navigate, t],
  );

  // ── Fuzzy search ─────────────────────────────────────

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q) ||
        cmd.keywords.some((kw) => kw.includes(q)),
    );
  }, [commands, query]);

  // ── Group by category ────────────────────────────────

  const grouped = useMemo(() => {
    const map = new Map<string, PaletteCommand[]>();
    for (const cmd of filtered) {
      const arr = map.get(cmd.category) ?? [];
      arr.push(cmd);
      map.set(cmd.category, arr);
    }
    return map;
  }, [filtered]);

  // ── Reset on open / query change ─────────────────────

  useEffect(() => {
    if (open) {
      // Focus after render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // ── Staggered reveal ─────────────────────────────────

  useEffect(() => {
    if (!open) return;
    if (visibleCount >= filtered.length) return;
    const delay = 25;
    const timer = setTimeout(() => setVisibleCount((c) => c + 1), delay);
    return () => clearTimeout(timer);
  }, [open, visibleCount, filtered.length]);

  // ── Keyboard nav ─────────────────────────────────────

  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-focus search input on open
  useEffect(() => {
    if (open) {
      // Small delay to let the portal render
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[activeIndex]?.action();
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Tab") {
      // Focus trap: cycle through focusable elements within the container
      const container = containerRef.current;
      if (!container) return;
      const focusables = container.querySelectorAll<HTMLElement>(
        'input, button, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-cmd-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // ── Render ───────────────────────────────────────────

  if (!open) return null;

  const isMac =
    typeof navigator !== "undefined" && navigator.platform?.toUpperCase().includes("MAC");
  const modKey = isMac ? "⌘" : "Ctrl";

  let flatIndex = 0;

  const panelBg = "var(--bg-elevated)";
  const panelBorder = "var(--border-default)";
  const textPri = "var(--text-primary)";
  const textSec = "var(--text-secondary)";
  const textTer = "var(--text-tertiary)";
  const accentSoft = "var(--accent-soft)";
  const accent = "var(--accent)";

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("aria.commandPalette")}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onKeyDown={onKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        onClick={() => setOpen(false)}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-[640px] rounded-2xl border shadow-2xl"
        style={{
          backgroundColor: panelBg,
          borderColor: panelBorder,
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: `1px solid ${panelBorder}` }}
        >
          <svg
            className="h-5 w-5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            style={{ color: textTer }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("commandPalette.typeCommand")}
            className="flex-1 bg-transparent text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            style={{ color: textPri }}
          />
          <kbd
            className="hidden rounded-md px-2 py-0.5 text-[11px] sm:inline"
            style={{
              border: `1px solid ${panelBorder}`,
              backgroundColor: accentSoft,
              color: textTer,
            }}
          >
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto p-2">
          {filtered.length === 0 && (
            <div className="py-8 text-center text-sm" style={{ color: textTer }}>{t("commandPalette.noCommandsFound")}</div>
          )}

          {[...grouped.entries()].map(([category, commands]) => (
            <div key={category}>
              <div
                className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider"
                style={{ color: textTer }}
              >
                {category}
              </div>
              {commands.map((cmd) => {
                const idx = flatIndex++;
                const isActive = idx === activeIndex;
                const visible = idx < visibleCount;
                return (
                  <button
                    key={cmd.id}
                    data-cmd-index={idx}
                    onClick={cmd.action}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-150"
                    style={{
                      backgroundColor: isActive ? accentSoft : "transparent",
                      color: isActive ? textPri : textSec,
                      opacity: visible ? 1 : 0,
                      transform: visible ? "translateY(0)" : "translateY(4px)",
                      transitionDelay: visible ? `${idx * 25}ms` : "0ms",
                    }}
                  >
                    <span className="flex-1 truncate">{cmd.label}</span>
                    <span
                      className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: isActive ? accentSoft : "var(--bg-inset)",
                        color: isActive ? accent : textTer,
                      }}
                    >
                      {cmd.category}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div
          className="flex items-center gap-4 px-5 py-2.5 text-[11px]"
          style={{ borderTop: `1px solid ${panelBorder}`, color: textTer }}
        >
          <span className="flex items-center gap-1">
            <kbd
              className="rounded px-1.5 py-0.5"
              style={{ border: `1px solid ${panelBorder}`, backgroundColor: accentSoft }}
            >↑↓</kbd>
            {t("common.navigate")}
          </span>
          <span className="flex items-center gap-1">
            <kbd
              className="rounded px-1.5 py-0.5"
              style={{ border: `1px solid ${panelBorder}`, backgroundColor: accentSoft }}
            >↵</kbd>
            {t("common.select")}
          </span>
          <span className="flex items-center gap-1">
            <kbd
              className="rounded px-1.5 py-0.5"
              style={{ border: `1px solid ${panelBorder}`, backgroundColor: accentSoft }}
            >
              {modKey}K
            </kbd>
            {t("common.toggle")}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
