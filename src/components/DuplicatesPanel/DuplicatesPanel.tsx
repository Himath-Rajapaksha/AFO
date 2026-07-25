import { useState } from "react";
import { Search, Trash2, Shield, ChevronRight } from "lucide-react";
import { scanDuplicates, quarantineDuplicates, deleteDuplicates, type DuplicateGroup } from "../../lib/tauri-bridge";
import { Card, CardHeader, CardDescription, CardRow } from "../ui/Card";
import Button from "../ui/Button";
import Toggle from "../ui/Toggle";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function DuplicatesPanel() {
  const [dirPath, setDirPath] = useState("");
  const [dirError, setDirError] = useState("");
  const [recursive, setRecursive] = useState(true);
  const [maxDepth, setMaxDepth] = useState(5);
  const [scanning, setScanning] = useState(false);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Map<number, Set<number>>>(new Map());
  const [actionError, setActionError] = useState("");

  async function pickDirectory() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const result = await open({ directory: true, multiple: false });
      if (result && typeof result === "string") { setDirPath(result); setGroups([]); setSelected(new Map()); setExpanded(new Set()); }
    } catch { setDirError("Directory picker not available."); }
  }

  async function handleScan() {
    if (!dirPath) return;
    setScanning(true); setActionError("");
    try { const res = await scanDuplicates(dirPath, recursive, recursive ? maxDepth : undefined); setGroups(res); setSelected(new Map()); setExpanded(new Set()); }
    catch (e) { setActionError(String(e)); } finally { setScanning(false); }
  }

  function toggleExpand(idx: number) { setExpanded((p) => { const n = new Set(p); n.has(idx) ? n.delete(idx) : n.add(idx); return n; }); }
  function toggleFile(gi: number, fi: number) { setSelected((p) => { const n = new Map(p); const g = new Set(n.get(gi) ?? []); g.has(fi) ? g.delete(fi) : g.add(fi); n.set(gi, g); return n; }); }
  function toggleGroupAll(gi: number, count: number) { setSelected((p) => { const n = new Map(p); const all = n.get(gi)?.size === count; n.set(gi, all ? new Set() : new Set(Array.from({ length: count }, (_, i) => i))); return n; }); }

  function getSelectedIndices(): number[] { return groups.reduce<number[]>((a, _, gi) => { const f = selected.get(gi); if (f && f.size > 0) a.push(gi); return a; }, []); }

  async function handleQuarantine() {
    const idx = getSelectedIndices(); if (idx.length === 0) return;
    try { await quarantineDuplicates(idx.map((i) => groups[i]), idx); await handleScan(); } catch (e) { setActionError(String(e)); }
  }
  async function handleDelete() {
    const idx = getSelectedIndices(); if (idx.length === 0) return;
    if (!confirm("Permanently delete selected duplicates?")) return;
    try { await deleteDuplicates(idx.map((i) => groups[i]), idx); await handleScan(); } catch (e) { setActionError(String(e)); }
  }

  const totalRecoverable = groups.reduce((s, g) => s + g.files.filter((f) => !f.is_keeper).reduce((a, f) => a + f.size, 0), 0);
  const totalNonKeeper = groups.reduce((s, g) => s + g.files.filter((f) => !f.is_keeper).length, 0);
  const hasSelection = getSelectedIndices().length > 0;

  return (
    <div className="flex flex-col gap-5 p-6">
      <div><h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Duplicate Detection</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Find and manage duplicate files across your directories.</p></div>

      {/* Directory */}
      <Card>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={pickDirectory} className="gap-2"><Search size={14} /> Choose Directory</Button>
          <div className="min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--bg-inset)", color: dirPath ? "var(--text-primary)" : "var(--text-tertiary)" }}>
            {dirPath || "No directory selected"}
          </div>
        </div>
        {dirError && <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>{dirError}</p>}
      </Card>

      {/* Detection Settings */}
      <Card>
        <CardHeader>Detection Settings</CardHeader>
        <CardDescription>Configure how duplicates are detected.</CardDescription>
        <CardRow label="Recursive" description="Scan subdirectories" control={<Toggle checked={recursive} onChange={setRecursive} label="Recursive scan" />} />
        {recursive && <CardRow label="Max Depth" control={<input type="number" min={1} max={20} value={maxDepth} onChange={(e) => setMaxDepth(Number(e.target.value) || 5)} aria-label="Max scan depth" className="w-16 rounded-lg px-2 py-1 text-sm text-center" style={{ backgroundColor: "var(--bg-inset)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />} />}
        <CardRow label="Hash Algorithm" rightValue="BLAKE3" />
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>Quick Actions</CardHeader>
        <Button onClick={handleScan} disabled={!dirPath || scanning} className="w-full gap-2">
          <Search size={14} /> {scanning ? "Scanning..." : "Scan for Duplicates"}
        </Button>
      </Card>

      {actionError && <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: "var(--accent-soft)", color: "var(--danger)" }}>{actionError}</div>}

      {/* Results Summary */}
      {groups.length > 0 && (
        <Card>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{groups.length}</div><div className="text-xs" style={{ color: "var(--text-tertiary)" }}>Groups</div></div>
            <div><div className="text-2xl font-bold" style={{ color: "var(--warning)" }}>{totalNonKeeper}</div><div className="text-xs" style={{ color: "var(--text-tertiary)" }}>Recoverable</div></div>
            <div><div className="text-2xl font-bold" style={{ color: "var(--success)" }}>{formatBytes(totalRecoverable)}</div><div className="text-xs" style={{ color: "var(--text-tertiary)" }}>Space</div></div>
          </div>
          <div className="mt-4 flex gap-3">
            <Button variant="secondary" onClick={handleQuarantine} disabled={!hasSelection} className="gap-2"><Shield size={14} /> Quarantine</Button>
            <Button variant="danger" onClick={handleDelete} disabled={!hasSelection} className="gap-2"><Trash2 size={14} /> Delete</Button>
          </div>
        </Card>
      )}

      {/* Groups */}
      {groups.map((group, gi) => {
        const isExpanded = expanded.has(gi);
        const groupSelected = selected.get(gi) ?? new Set();
        const allSelected = groupSelected.size === group.files.length;
        return (
          <Card key={gi}>
            <div className="flex items-center gap-4">
              <button onClick={() => toggleExpand(gi)} aria-label={isExpanded ? "Collapse group" : "Expand group"} aria-expanded={isExpanded} className="shrink-0 transition-transform" style={{ color: "var(--text-tertiary)", transform: isExpanded ? "rotate(90deg)" : "" }}>
                <ChevronRight size={14} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-xs" style={{ color: "var(--text-secondary)" }} title={group.hash}>{group.hash}</div>
                <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{group.files.length} files · {formatBytes(group.total_size)}</div>
              </div>
              <Button variant="secondary" onClick={() => toggleGroupAll(gi, group.files.length)} className="text-xs px-3 py-1">
                {allSelected ? "Deselect All" : "Select All"}
              </Button>
            </div>
            {isExpanded && (
              <div className="mt-3 space-y-1.5" style={{ borderTop: "1px solid var(--border-default)", paddingTop: 12 }}>
                {group.files.map((file, fi) => (
                  <label key={fi} className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors" style={{ backgroundColor: groupSelected.has(fi) ? "var(--accent-soft)" : "transparent" }}>
                    <input type="checkbox" checked={groupSelected.has(fi)} onChange={() => toggleFile(gi, fi)} className="h-4 w-4 rounded accent-[var(--accent)]" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm" style={{ color: "var(--text-primary)" }}>{file.path}</div>
                      <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{formatBytes(file.size)}</div>
                    </div>
                    {file.is_keeper && <span className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: "var(--accent-soft)", color: "var(--success)" }}>Keeper</span>}
                  </label>
                ))}
              </div>
            )}
          </Card>
        );
      })}

      {!scanning && dirPath && groups.length === 0 && <Card><p className="text-sm text-center py-4" style={{ color: "var(--text-tertiary)" }}>No duplicates found.</p></Card>}
    </div>
  );
}
