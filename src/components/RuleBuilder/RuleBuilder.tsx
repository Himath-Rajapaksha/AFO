import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Trash2, FolderOpen, Sparkles, Download, Upload } from "lucide-react";
import { listRules, saveRules, exportRules, importRules, applyRules, type Rule, type RuleCondition, type RuleAction } from "../../lib/tauri-bridge";
import { Card, CardHeader, CardDescription, CardRow } from "../ui/Card";
import Button from "../ui/Button";
import Toggle from "../ui/Toggle";
import RuleFlowEditor from "./RuleFlowEditor";

function emptyCondition(): RuleCondition { return { field: "Extension", operator: "Contains", value: "" }; }
function emptyAction(): RuleAction { return { Move: { destination: "" } }; }
function makeId(): string { return crypto.randomUUID(); }

interface PresetRule {
  name: string;
  description: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

const PRESET_RULES: PresetRule[] = [
  {
    name: "Organize Images",
    description: "Move image files to an Images folder",
    conditions: [{ field: "Extension", operator: "Equals", value: ".jpg,.jpeg,.png,.gif,.bmp,.webp,.svg,.ico" }],
    actions: [{ Move: { destination: "~/Images" } }],
  },
  {
    name: "Organize Documents",
    description: "Move documents to a Documents folder",
    conditions: [{ field: "Extension", operator: "Equals", value: ".pdf,.doc,.docx,.txt,.rtf,.odt,.xls,.xlsx,.ppt,.pptx,.csv" }],
    actions: [{ Move: { destination: "~/Documents" } }],
  },
  {
    name: "Organize Videos",
    description: "Move video files to a Videos folder",
    conditions: [{ field: "Extension", operator: "Equals", value: ".mp4,.avi,.mkv,.mov,.wmv,.flv,.webm,.m4v" }],
    actions: [{ Move: { destination: "~/Videos" } }],
  },
  {
    name: "Organize Music",
    description: "Move audio files to a Music folder",
    conditions: [{ field: "Extension", operator: "Equals", value: ".mp3,.wav,.flac,.aac,.ogg,.wma,.m4a,.opus" }],
    actions: [{ Move: { destination: "~/Music" } }],
  },
  {
    name: "Archive Old Files",
    description: "Move files older than 90 days to Archives",
    conditions: [{ field: "DateModified", operator: "LessThan", value: "90" }],
    actions: [{ Move: { destination: "~/Archives" } }],
  },
  {
    name: "Sort by Date (Year/Month)",
    description: "Organize files into year/month folders based on creation date",
    conditions: [{ field: "Extension", operator: "Contains", value: "." }],
    actions: [{ Move: { destination: "~/Sorted/{year}/{month}" } }],
  },
  {
    name: "Catch Downloads",
    description: "Move downloaded installers and archives to Downloads sorted folder",
    conditions: [{ field: "Extension", operator: "Equals", value: ".exe,.msi,.dmg,.pkg,.deb,.rpm,.zip,.tar,.gz,.rar,.7z" }],
    actions: [{ Move: { destination: "~/Downloads/Installers" } }],
  },
  {
    name: "Organize Screenshots",
    description: "Move screenshots to a dedicated folder",
    conditions: [{ field: "Name", operator: "Contains", value: "screenshot,Screen Shot,Snip" }],
    actions: [{ Move: { destination: "~/Pictures/Screenshots" } }],
  },
  {
    name: "Sort Large Files",
    description: "Move files larger than 100MB to Large Files folder",
    conditions: [{ field: "Size", operator: "GreaterThan", value: "104857600" }],
    actions: [{ Move: { destination: "~/Large Files" } }],
  },
  {
    name: "Organize Code Files",
    description: "Move source code files to a Code folder",
    conditions: [{ field: "Extension", operator: "Equals", value: ".py,.js,.ts,.jsx,.tsx,.java,.c,.cpp,.h,.rs,.go,.rb,.php,.html,.css,.json,.yaml,.yml,.toml" }],
    actions: [{ Move: { destination: "~/Code" } }],
  },
];

const inputCls = "rounded-lg px-3 py-1.5 text-sm outline-none";
const inputStyle = { backgroundColor: "var(--bg-inset)", border: "1px solid var(--border-default)", color: "var(--text-primary)" };

export default function RuleBuilder() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formConditions, setFormConditions] = useState<RuleCondition[]>([emptyCondition()]);
  const [formActions, setFormActions] = useState<RuleAction[]>([emptyAction()]);
  const [dryRunPath, setDryRunPath] = useState("");
  const [dryRunResult, setDryRunResult] = useState("");
  const [useVisualEditor, setUseVisualEditor] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => { try { setRules(await listRules()); } catch (e) { setError(String(e)); } }, []);
  useEffect(() => { refresh().finally(() => setLoading(false)); }, [refresh]);

  function startCreate() { setEditing("new"); setFormName(""); setFormConditions([emptyCondition()]); setFormActions([emptyAction()]); }
  function startEdit(rule: Rule) { setEditing(rule.id); setFormName(rule.name); setFormConditions([...rule.conditions]); setFormActions([...rule.actions]); }
  function cancel() { setEditing(null); }

  async function handleSave() {
    if (!formName.trim()) return;
    const updated = editing === "new"
      ? [...rules, { id: makeId(), name: formName.trim(), enabled: true, conditions: formConditions, actions: formActions }]
      : rules.map((r) => r.id === editing ? { ...r, name: formName.trim(), conditions: formConditions, actions: formActions } : r);
    try { await saveRules(updated); setRules(updated); setEditing(null); } catch (e) { setError(String(e)); }
  }

  async function toggleRule(id: string) {
    const updated = rules.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r);
    try { await saveRules(updated); setRules(updated); } catch (e) { setError(String(e)); }
  }

  async function deleteRule(id: string) {
    const updated = rules.filter((r) => r.id !== id);
    try { await saveRules(updated); setRules(updated); if (editing === id) setEditing(null); } catch (e) { setError(String(e)); }
  }

  async function handleDryRun() {
    if (!dryRunPath) return;
    try { const res = await applyRules(dryRunPath, true); setDryRunResult(`${res.moved} files affected (${res.skipped} skipped, ${res.errors.length} errors)`); } catch (e) { setDryRunResult(`Error: ${e}`); }
  }

  async function handleExport() {
    if (rules.length === 0) { setError("No rules to export"); return; }
    try {
      const json = await exportRules(rules);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `afo-rules-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(String(e)); }
  }

  function handleImportClick() { fileInputRef.current?.click(); }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = await importRules(text);
      const existingNames = new Set(rules.map((r) => r.name));
      const conflicts = imported.filter((r) => existingNames.has(r.name));
      let merged: Rule[];
      if (conflicts.length > 0) {
        const withoutConflicts = imported.filter((r) => !existingNames.has(r.name));
        const updatedExisting = rules.map((r) => {
          const replacement = conflicts.find((c) => c.name === r.name);
          return replacement ? { ...replacement, id: r.id } : r;
        });
        merged = [...updatedExisting, ...withoutConflicts];
      } else {
        merged = [...rules, ...imported];
      }
      await saveRules(merged);
      setRules(merged);
    } catch (e) { setError(String(e)); }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function addPreset(preset: PresetRule) {
    const newRule: Rule = { id: makeId(), name: preset.name, enabled: true, conditions: preset.conditions, actions: preset.actions };
    const updated = [...rules, newRule];
    saveRules(updated).then(() => setRules(updated)).catch((e) => setError(String(e)));
  }

  const addedPresetNames = new Set(rules.map((r) => r.name));

  if (loading) return <div className="p-6"><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Rule Builder</h1><p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>Loading rules...</p></div>;

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex items-start justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Rule Builder</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Define conditions and actions to organize files automatically.</p></div>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
          <Button variant="secondary" onClick={handleExport} className="gap-2"><Download size={14} /> Export</Button>
          <Button variant="secondary" onClick={handleImportClick} className="gap-2"><Upload size={14} /> Import</Button>
          <Button onClick={startCreate} className="gap-2"><Plus size={14} /> Create Rule</Button>
        </div>
      </div>

      {error && <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: "var(--accent-soft)", color: "var(--danger)" }}>{error}</div>}

      {/* Rule Builder Settings */}
      <Card>
        <CardHeader>Rule Builder Settings</CardHeader>
        <CardDescription>Configure how the rule builder behaves.</CardDescription>
        <CardRow label="Visual Rule Editor" description="Use node-based flow editor" control={<Toggle checked={useVisualEditor} onChange={setUseVisualEditor} />} />
        <CardRow label="Live Preview" description="Not yet connected to backend" control={<Toggle checked={true} onChange={() => {}} disabled />} />
      </Card>

      {/* Preset Rules */}
      <Card>
        <CardHeader>
          <span className="flex items-center gap-2"><Sparkles size={14} style={{ color: "var(--accent)" }} /> Preset Rules</span>
        </CardHeader>
        <CardDescription>Quick-start templates for common file organization tasks. Click to add.</CardDescription>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {PRESET_RULES.map((preset) => {
            const added = addedPresetNames.has(preset.name);
            return (
              <button
                key={preset.name}
                onClick={() => !added && addPreset(preset)}
                disabled={added}
                className="flex flex-col items-start rounded-lg px-3 py-2 text-left transition-colors"
                style={{
                  backgroundColor: "var(--bg-inset)",
                  border: "1px solid var(--border-default)",
                  opacity: added ? 0.5 : 1,
                  cursor: added ? "default" : "pointer",
                }}
              >
                <span className="text-xs font-medium" style={{ color: added ? "var(--text-tertiary)" : "var(--text-primary)" }}>
                  {added ? "✓ " : ""}{preset.name}
                </span>
                <span className="text-[10px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>{preset.description}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Rules List */}
      {rules.length === 0 && !editing ? (
        <Card><p className="text-sm text-center py-4" style={{ color: "var(--text-tertiary)" }}>No rules yet. Create one to get started.</p></Card>
      ) : (
        <div className="space-y-2">
          {/* New rule form (above existing rules) */}
          {editing === "new" && (
            useVisualEditor ? (
              <Card>
                <RuleFlowEditor
                  rule={{ id: "", name: formName || "New Rule", enabled: true, conditions: [], actions: [] }}
                  onSave={(conditions, actions) => {
                    const newRule = { id: makeId(), name: formName.trim() || "New Rule", enabled: true, conditions, actions };
                    const updated = [...rules, newRule];
                    saveRules(updated).then(() => { setRules(updated); setEditing(null); }).catch((e) => setError(String(e)));
                  }}
                  onCancel={cancel}
                />
              </Card>
            ) : (
              <Card>
                <div className="space-y-3">
                  <div><label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Rule Name</label>
                    <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Organize images" className={`w-full ${inputCls}`} style={inputStyle} /></div>
                  <div><label className="mb-2 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Conditions</label>
                    {formConditions.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 mb-2">
                        <select value={c.field} onChange={(e) => setFormConditions((prev) => prev.map((x, j) => j === i ? { ...x, field: e.target.value as RuleCondition["field"] } : x))} className={`rounded-lg px-2 py-1.5 text-sm ${inputCls}`} style={inputStyle}>
                          {["Extension", "Name", "Size", "DateCreated", "DateModified"].map((f) => <option key={f}>{f}</option>)}
                        </select>
                        <select value={c.operator} onChange={(e) => setFormConditions((prev) => prev.map((x, j) => j === i ? { ...x, operator: e.target.value as RuleCondition["operator"] } : x))} className={`rounded-lg px-2 py-1.5 text-sm ${inputCls}`} style={inputStyle}>
                          {["Equals", "Contains", "StartsWith", "EndsWith", "GreaterThan", "LessThan", "Regex"].map((o) => <option key={o}>{o}</option>)}
                        </select>
                        <input type="text" value={c.value} onChange={(e) => setFormConditions((prev) => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder="value" className={`min-w-0 flex-1 ${inputCls}`} style={inputStyle} />
                        {formConditions.length > 1 && <button onClick={() => setFormConditions((prev) => prev.filter((_, j) => j !== i))} style={{ color: "var(--text-tertiary)" }}><Trash2 size={12} /></button>}
                      </div>
                    ))}
                    <button onClick={() => setFormConditions((prev) => [...prev, emptyCondition()])} className="text-xs" style={{ color: "var(--accent)" }}>+ Add Condition</button>
                  </div>
                  <div className="flex gap-2"><Button onClick={handleSave}>Save Rule</Button><Button variant="secondary" onClick={cancel}>Cancel</Button></div>
                </div>
              </Card>
            )
          )}

          {/* Existing rules */}
          {rules.map((rule) => editing === rule.id ? (
            useVisualEditor ? (
              <Card key={rule.id}>
                <RuleFlowEditor
                  rule={rule}
                  onSave={(conditions, actions) => {
                    const updated = rules.map((r) => r.id === editing ? { ...r, name: formName.trim() || rule.name, conditions, actions } : r);
                    saveRules(updated).then(() => { setRules(updated); setEditing(null); }).catch((e) => setError(String(e)));
                  }}
                  onCancel={cancel}
                />
              </Card>
            ) : (
              <Card key={rule.id}>
                <div className="space-y-3">
                  <div><label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Rule Name</label>
                    <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Organize images" className={`w-full ${inputCls}`} style={inputStyle} /></div>
                  <div><label className="mb-2 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Conditions</label>
                    {formConditions.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 mb-2">
                        <select value={c.field} onChange={(e) => setFormConditions((prev) => prev.map((x, j) => j === i ? { ...x, field: e.target.value as RuleCondition["field"] } : x))} className={`rounded-lg px-2 py-1.5 text-sm ${inputCls}`} style={inputStyle}>
                          {["Extension", "Name", "Size", "DateCreated", "DateModified"].map((f) => <option key={f}>{f}</option>)}
                        </select>
                        <select value={c.operator} onChange={(e) => setFormConditions((prev) => prev.map((x, j) => j === i ? { ...x, operator: e.target.value as RuleCondition["operator"] } : x))} className={`rounded-lg px-2 py-1.5 text-sm ${inputCls}`} style={inputStyle}>
                          {["Equals", "Contains", "StartsWith", "EndsWith", "GreaterThan", "LessThan", "Regex"].map((o) => <option key={o}>{o}</option>)}
                        </select>
                        <input type="text" value={c.value} onChange={(e) => setFormConditions((prev) => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder="value" className={`min-w-0 flex-1 ${inputCls}`} style={inputStyle} />
                        {formConditions.length > 1 && <button onClick={() => setFormConditions((prev) => prev.filter((_, j) => j !== i))} style={{ color: "var(--text-tertiary)" }}><Trash2 size={12} /></button>}
                      </div>
                    ))}
                    <button onClick={() => setFormConditions((prev) => [...prev, emptyCondition()])} className="text-xs" style={{ color: "var(--accent)" }}>+ Add Condition</button>
                  </div>
                  <div className="flex gap-2"><Button onClick={handleSave}>Save Rule</Button><Button variant="secondary" onClick={cancel}>Cancel</Button></div>
                </div>
              </Card>
            )
          ) : (
            <Card key={rule.id}>
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium" style={{ color: rule.enabled ? "var(--text-primary)" : "var(--text-tertiary)" }}>{rule.name}</div>
                  <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{rule.conditions.length} condition{rule.conditions.length !== 1 ? "s" : ""} · {rule.actions.length} action{rule.actions.length !== 1 ? "s" : ""}</div>
                </div>
                <Toggle checked={rule.enabled} onChange={() => toggleRule(rule.id)} size="sm" />
                <Button variant="secondary" onClick={() => startEdit(rule)} className="text-xs px-3 py-1.5">Edit</Button>
                <Button variant="danger" onClick={() => deleteRule(rule.id)} className="text-xs px-3 py-1.5 opacity-70 hover:opacity-100">Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Test Rules */}
      <Card>
        <CardHeader>Test Rules</CardHeader>
        <CardDescription>Enter a directory path to dry-run all rules against.</CardDescription>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={async () => {
            try {
              const { open } = await import("@tauri-apps/plugin-dialog");
              const sel = await open({ directory: true, multiple: false });
              if (sel && typeof sel === "string") setDryRunPath(sel);
            } catch { /* ignore */ }
          }} className="gap-2"><FolderOpen size={14} /> Choose Directory</Button>
          <input type="text" value={dryRunPath} onChange={(e) => setDryRunPath(e.target.value)} placeholder="/path/to/directory" className={`min-w-0 flex-1 ${inputCls}`} style={inputStyle} />
          <Button variant="secondary" onClick={handleDryRun} disabled={!dryRunPath}>Dry Run</Button>
        </div>
        {dryRunResult && <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>{dryRunResult}</p>}
      </Card>
    </div>
  );
}
