import { useState, useEffect, useCallback } from "react";
import { RotateCcw, RotateCw, Undo2, Zap, Search, X } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { getHistory, searchHistory, undoLast, undoOperation, redoLast, type JournalEntry, type HistoryFilter } from "../../lib/tauri-bridge";
import { Card, CardHeader, CardRow } from "../ui/Card";
import Button from "../ui/Button";
import Toggle from "../ui/Toggle";

const PAGE_SIZE = 20;
const OP_COLORS: Record<string, { bg: string; fg: string }> = {
  move: { bg: "var(--accent-soft)", fg: "var(--info)" },
  copy: { bg: "var(--accent-soft)", fg: "var(--success)" },
  rename: { bg: "var(--accent-soft)", fg: "var(--warning)" },
  delete: { bg: "var(--accent-soft)", fg: "var(--danger)" },
};

interface LiveEvent {
  id: string;
  type: string;
  source: string;
  destination?: string;
  rule?: string;
  timestamp: Date;
}

// Design decision: When "Enable Undo/Redo" is turned OFF, we only hide the UI controls.
// Journal writes continue underneath so turning it back on preserves full history.
// This avoids data loss from toggling the setting and keeps the simpler mental model:
// "undo is always recording, I just can't see it right now."
const STORAGE_KEY_ENABLE_UNDO = "afo:enableUndoRedo";

export default function HistoryPanel() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [acting, setActing] = useState(false);
  const [enableUndoRedo, setEnableUndoRedo] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY_ENABLE_UNDO);
    return stored !== null ? stored === "true" : true;
  });
  const [keepFullHistory] = useState(true);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Persist the setting to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ENABLE_UNDO, String(enableUndoRedo));
  }, [enableUndoRedo]);

  useEffect(() => {
    const unlisten = listen<{ type: string; source: string; destination?: string; rule?: string }>(
      "afo://activity",
      (event) => {
        const { type, source, destination, rule } = event.payload;
        setLiveEvents((prev) => [
          { id: crypto.randomUUID(), type, source, destination, rule, timestamp: new Date() },
          ...prev,
        ].slice(0, 50));
      },
    );
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const hasActiveFilter = searchQuery || filterType !== "all" || filterDateFrom || filterDateTo;

  const refresh = useCallback(async (off = 0, append = false) => {
    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 200;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const filter: HistoryFilter = {};
        if (searchQuery) filter.query = searchQuery;
        if (filterType !== "all") filter.operation_type = filterType;
        if (filterDateFrom) filter.date_from = filterDateFrom;
        if (filterDateTo) filter.date_to = filterDateTo + "T23:59:59";

        const batch = hasActiveFilter
          ? await searchHistory(filter, PAGE_SIZE, off)
          : await getHistory(PAGE_SIZE, off);
        setEntries((p) => (append ? [...p, ...batch] : batch));
        setHasMore(batch.length === PAGE_SIZE);
        setError("");
        setLoading(false);
        return;
      } catch (e) {
        const msg = String(e);
        if (msg.includes("Journal not initialized") && attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
          continue;
        }
        setError(msg);
        break;
      }
    }
    setLoading(false);
  }, [searchQuery, filterType, filterDateFrom, filterDateTo, hasActiveFilter]);

  useEffect(() => { setOffset(0); refresh(0); }, [refresh]);

  function clearFilters() {
    setSearchQuery("");
    setFilterType("all");
    setFilterDateFrom("");
    setFilterDateTo("");
  }

  async function handleLoadMore() { const next = offset + PAGE_SIZE; setOffset(next); await refresh(next, true); }
  async function handleUndoLast() { setActing(true); try { await undoLast(); setOffset(0); await refresh(0); } catch (e) { setError(String(e)); } finally { setActing(false); } }
  async function handleRedo() { setActing(true); try { await redoLast(); setOffset(0); await refresh(0); } catch (e) { setError(String(e)); } finally { setActing(false); } }
  async function handleUndoEntry(id: number) { setActing(true); try { await undoOperation(id); setOffset(0); await refresh(0); } catch (e) { setError(String(e)); } finally { setActing(false); } }

  if (loading) return <div className="p-6"><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>History</h1><p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>Loading...</p></div>;

  return (
    <div className="flex flex-col gap-5 p-6">
      <div><h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>History</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Browse past operations and undo or redo them.</p></div>

      {/* History Settings */}
      <Card>
        <CardHeader>History Settings</CardHeader>
        <CardRow label="Enable Undo/Redo" description="Show undo/redo controls (journal always records)" control={<Toggle checked={enableUndoRedo} onChange={setEnableUndoRedo} />} />
        <CardRow label="Keep Full History" description="Store all operations (always on)" control={<Toggle checked={keepFullHistory} onChange={() => {}} disabled />} />
      </Card>

      {/* Search & Filters */}
      <Card>
        <CardHeader>Search & Filter</CardHeader>
        <div className="flex flex-col gap-3 mt-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }} />
              <input
                type="text"
                placeholder="Search by filename..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg pl-9 pr-8 py-1.5 text-sm outline-none"
                style={{ backgroundColor: "var(--bg-inset)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }}>
                  <X size={14} />
                </button>
              )}
            </div>
            {hasActiveFilter && (
              <Button variant="secondary" onClick={clearFilters} className="text-xs px-3 py-1.5 gap-1">
                <X size={12} /> Clear
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-sm outline-none"
              style={{ backgroundColor: "var(--bg-inset)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
            >
              <option value="all">All operations</option>
              <option value="move">Move</option>
              <option value="copy">Copy</option>
              <option value="rename">Rename</option>
              <option value="delete">Delete</option>
            </select>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              placeholder="From"
              className="rounded-lg px-3 py-1.5 text-sm outline-none"
              style={{ backgroundColor: "var(--bg-inset)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
            />
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              placeholder="To"
              className="rounded-lg px-3 py-1.5 text-sm outline-none"
              style={{ backgroundColor: "var(--bg-inset)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
            />
          </div>
        </div>
      </Card>

      {/* Actions - only shown when undo/redo is enabled */}
      {enableUndoRedo && (
        <Card>
          <CardHeader>Actions</CardHeader>
          <div className="flex gap-3 mt-1">
            <Button variant="secondary" onClick={handleUndoLast} disabled={acting || entries.length === 0} className="gap-2"><RotateCcw size={14} /> Undo Last</Button>
            <Button variant="secondary" onClick={handleRedo} disabled={acting} className="gap-2"><RotateCw size={14} /> Redo</Button>
          </div>
        </Card>
      )}

      {error && <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: "var(--accent-soft)", color: "var(--danger)" }}>{error}</div>}

      {/* Live Activity Feed */}
      {liveEvents.length > 0 && (
        <Card>
          <CardHeader>
            <span className="flex items-center gap-2"><Zap size={14} style={{ color: "var(--success)" }} /> Live Activity</span>
          </CardHeader>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {liveEvents.map((evt) => {
              const colors = OP_COLORS[evt.type] ?? { bg: "var(--bg-inset)", fg: "var(--text-secondary)" };
              const filename = evt.source.split(/[\\/]/).pop() || evt.source;
              return (
                <div key={evt.id} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-inset)" }}>
                  <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase" style={{ backgroundColor: colors.bg, color: colors.fg }}>{evt.type}</span>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{filename}</span>
                    {evt.destination && (
                      <span className="text-xs" style={{ color: "var(--text-tertiary)" }}> → {evt.destination.split(/[\\/]/).pop()}</span>
                    )}
                    {evt.rule && (
                      <span className="text-xs ml-1" style={{ color: "var(--accent)" }}>({evt.rule})</span>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px]" style={{ color: "var(--text-tertiary)" }}>{evt.timestamp.toLocaleTimeString()}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Recent Operations */}
      <Card>
        <CardHeader>Recent Operations</CardHeader>
        {entries.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: "var(--text-tertiary)" }}>No history yet. Perform an operation to see it here.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => {
              const colors = OP_COLORS[entry.operation_type.toLowerCase()] ?? { bg: "var(--bg-inset)", fg: "var(--text-secondary)" };
              return (
                <div key={entry.id} className="flex items-center gap-4 rounded-lg px-4 py-3 transition-colors" style={{ borderBottom: "1px solid var(--border-default)", opacity: entry.reverted ? 0.4 : 1 }}>
                  <span className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ backgroundColor: colors.bg, color: colors.fg }}>{entry.operation_type}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm" style={{ color: "var(--text-primary)" }} title={entry.source_path}>{entry.source_path}</div>
                    <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>→ <span className="truncate" style={{ color: "var(--text-secondary)" }} title={entry.dest_path}>{entry.dest_path || "—"}</span></div>
                  </div>
                  <div className="shrink-0 text-xs" style={{ color: "var(--text-tertiary)" }}>{new Date(entry.timestamp).toLocaleString()}</div>
                  {entry.reverted && <span className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: "var(--bg-inset)", color: "var(--text-tertiary)" }}>Reverted</span>}
                  {!entry.reverted && enableUndoRedo && <Button variant="secondary" onClick={() => handleUndoEntry(entry.id)} disabled={acting} className="text-xs px-3 py-1.5"><Undo2 size={12} /> Undo</Button>}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {hasMore && entries.length > 0 && <Button variant="secondary" onClick={handleLoadMore} className="self-center">Load More</Button>}
    </div>
  );
}
