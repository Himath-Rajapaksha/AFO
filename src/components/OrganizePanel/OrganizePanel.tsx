import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import { FolderOpen, Play, Search } from "lucide-react";
import Toggle from "../ui/Toggle";
import {
  scanDirectory,
  organizeByExtension,
  organizeByDate,
  batchRename,
  getMetadata,
  type FileInfo,
  type OrganizeResult,
  type FileMetadata,
} from "../../lib/tauri-bridge";
import { useAppStore } from "../../lib/store";
import { showToast } from "../Toast";
import PreviewPane from "../PreviewPane";
import { Card, CardHeader, CardRow } from "../ui/Card";
import Button from "../ui/Button";
import SegmentedControl from "../ui/SegmentedControl";

type Mode = "extension" | "date" | "rename";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function OrganizePanel() {
  const { t } = useTranslation();
  const [dirPath, setDirPath] = useState("");
  const [dirError, setDirError] = useState("");
  const [mode, setMode] = useState<Mode>("extension");
  const [dateFormat, setDateFormat] = useState<"yearmonth" | "fulldate">("yearmonth");
  const [renamePattern, setRenamePattern] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number; file: string } | null>(null);
  const [result, setResult] = useState<OrganizeResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<FileMetadata | null>(null);

  useEffect(() => {
    const unlisten = listen<{ current: number; total: number; file: string; status: string }>(
      "afo://progress",
      (event) => setProgress({ current: event.payload.current, total: event.payload.total, file: event.payload.file }),
    );
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const droppedPaths = useAppStore((s) => s.droppedPaths);
  const clearDroppedPaths = useAppStore((s) => s.clearDroppedPaths);
  useEffect(() => {
    if (droppedPaths.length === 0) return;
    const first = droppedPaths[0];
    const isFile = first.includes(".") && !first.endsWith("/");
    setDirPath(isFile ? first.split("/").slice(0, -1).join("/") || "/" : first);
    setFiles([]);
    setResult(null);
    clearDroppedPaths();
    showToast(t('app.addedPaths', { count: droppedPaths.length }), "info");
  }, [droppedPaths, clearDroppedPaths]);

  async function pickDirectory() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === "string") { setDirPath(selected); setFiles([]); setResult(null); }
    } catch { setDirError(t('app.directoryPickerNotAvailable')); }
  }

  async function handleScan() {
    if (!dirPath) return;
    setScanning(true); setResult(null);
    try { setFiles(await scanDirectory(dirPath)); } catch (e) { setDirError(String(e)); } finally { setScanning(false); }
  }

  async function handleExecute() {
    if (!dirPath) return;
    setExecuting(true); setResult(null); setProgress(null);
    try {
      let res: OrganizeResult;
      switch (mode) {
        case "extension": res = await organizeByExtension(dirPath, dryRun); break;
        case "date": res = await organizeByDate(dirPath, dryRun, dateFormat); break;
        case "rename": res = await batchRename(dirPath, renamePattern, dryRun); break;
      }
      setResult(res);
      if (res.moved > 0) showToast(dryRun ? t('app.preview', { count: res.moved }) : t('app.organized', { count: res.moved }), "success");
    } catch (e) { setResult({ total_files: 0, moved: 0, skipped: 0, errors: [String(e)], dry_run: dryRun }); showToast(t('app.error', { error: String(e) }), "error"); }
    finally { setExecuting(false); setProgress(null); }
  }

  async function handleFileClick(filePath: string) {
    setSelectedFile(filePath);
    try { setMetadata(await getMetadata(filePath)); } catch { setMetadata(null); }
  }

  const displayedFiles = files.slice(0, 20);

  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>{t('organize.title')}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{t('organize.description')}</p>
      </div>

      {/* Directory Picker */}
      <Card>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={pickDirectory} className="gap-2">
            <FolderOpen size={14} /> {t('organize.chooseDirectory')}
          </Button>
          <div className="min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--bg-inset)", color: dirPath ? "var(--text-primary)" : "var(--text-tertiary)" }}>
            {dirPath || t('organize.noDirectorySelected')}
          </div>
        </div>
        {dirError && <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>{dirError}</p>}
      </Card>

      {/* Mode */}
      <Card>
        <CardHeader>{t('organize.organizeMode')}</CardHeader>
        <SegmentedControl
          options={[
            { value: "extension" as Mode, label: t('organize.byExtension') },
            { value: "date" as Mode, label: t('organize.byDate') },
            { value: "rename" as Mode, label: t('organize.batchRename') },
          ]}
          value={mode}
          onChange={(v) => { setMode(v); setResult(null); }}
          layoutId="organize-mode"
        />
        {mode === "date" && (
          <div className="mt-3">
            <CardRow label={t('organize.dateFormat')} control={
              <SegmentedControl options={[
                { value: "yearmonth" as const, label: t('organize.yearMonth') },
                { value: "fulldate" as const, label: t('organize.fullDate') },
              ]} value={dateFormat} onChange={(v) => setDateFormat(v)} size="sm" layoutId="organize-dateformat" />
            } />
          </div>
        )}
        {mode === "rename" && (
          <div className="mt-3 space-y-2">
            <CardRow label={t('organize.renamePattern')} description={t('organize.renamePatternDesc')} control={
              <input type="text" value={renamePattern} onChange={(e) => setRenamePattern(e.target.value)} placeholder="{name}_{counter}.{ext}" aria-label={t('aria.renamePattern')}
                className="w-48 rounded-lg px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" style={{ backgroundColor: "var(--bg-inset)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />
            } />
          </div>
        )}
      </Card>

      {/* Options */}
      <Card>
        <CardRow label={t('organize.previewOnly')} control={
          <Toggle checked={dryRun} onChange={setDryRun} label={t('organize.previewOnlyLabel')} />
        } />
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="secondary" onClick={handleScan} disabled={!dirPath || scanning} className="gap-2">
          <Search size={14} /> {scanning ? t('organize.scanning') : t('organize.scan')}
        </Button>
        <Button onClick={handleExecute} disabled={!dirPath || executing || (mode === "rename" && !renamePattern)} className="gap-2">
          <Play size={14} /> {executing ? t('organize.running') : t('organize.execute')}
        </Button>
      </div>

      {/* Progress */}
      {progress && (
        <Card>
          <div className="mb-2 flex items-center justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
            <span>{t('organize.processing')} <span style={{ color: "var(--text-primary)" }}>{progress.file}</span></span>
            <span>{progress.current} / {progress.total}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--bg-inset)" }}>
            <div className="h-full rounded-full transition-all duration-150" style={{ width: `${(progress.current / progress.total) * 100}%`, backgroundColor: "var(--accent)" }} />
          </div>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <CardHeader>{t('organize.result')}</CardHeader>
            {result.dry_run && <span className="rounded-md px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}>{t('organize.dryRun')}</span>}
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{result.total_files}</div><div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{t('organize.totalFiles')}</div></div>
            <div><div className="text-2xl font-bold" style={{ color: "var(--success)" }}>{result.moved}</div><div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{t('organize.moved')}</div></div>
            <div><div className="text-2xl font-bold" style={{ color: "var(--text-secondary)" }}>{result.skipped}</div><div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{t('organize.skipped')}</div></div>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-3 rounded-lg p-3" style={{ backgroundColor: "var(--accent-soft)" }}>
              <p className="mb-1 text-xs font-medium" style={{ color: "var(--danger)" }}>{t('organize.errors')}</p>
              <ul className="space-y-0.5">{result.errors.map((err, i) => <li key={i} className="text-xs" style={{ color: "var(--danger)" }}>{err}</li>)}</ul>
            </div>
          )}
        </Card>
      )}

      {/* Scanned Files */}
      {files.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <CardHeader>{t('organize.scannedFiles', { count: files.length })}</CardHeader>
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{t('organize.showing', { shown: displayedFiles.length, total: files.length })}</span>
          </div>
          <div className="overflow-hidden rounded-lg" style={{ border: "1px solid var(--border-default)" }}>
            <table className="w-full text-left text-sm">
              <thead><tr style={{ borderBottom: "1px solid var(--border-default)", backgroundColor: "var(--bg-inset)" }}>
                <th className="px-3 py-2 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{t('organize.name')}</th>
                <th className="px-3 py-2 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{t('organize.ext')}</th>
                <th className="px-3 py-2 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{t('organize.size')}</th>
              </tr></thead>
              <tbody>{displayedFiles.map((f, i) => (
                <tr key={i} role="button" tabIndex={0}
                  onClick={() => handleFileClick(f.path)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleFileClick(f.path); } }}
                  aria-label={t('organize.viewMetadataFor', { name: f.name })}
                  className="cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  style={{ borderBottom: "1px solid var(--border-default)", backgroundColor: selectedFile === f.path ? "var(--accent-soft)" : "transparent" }}>
                  <td className="max-w-[240px] truncate px-3 py-1.5" style={{ color: "var(--text-primary)" }}>{f.name}</td>
                  <td className="px-3 py-1.5" style={{ color: "var(--text-secondary)" }}>{f.extension}</td>
                  <td className="px-3 py-1.5" style={{ color: "var(--text-secondary)" }}>{formatBytes(f.size)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      )}

      {files.length > 0 && <PreviewPane files={files} mode={mode} dirPath={dirPath} dateFormat={dateFormat} renamePattern={renamePattern} />}

      {/* Metadata */}
      {selectedFile && metadata && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <CardHeader>{t('organize.fileMetadata')}</CardHeader>
            <button onClick={() => { setSelectedFile(null); setMetadata(null); }} className="text-xs" style={{ color: "var(--text-tertiary)" }}>{t('organize.close')}</button>
          </div>
          <div className="text-xs mb-3 truncate" style={{ color: "var(--text-secondary)" }}>{selectedFile}</div>
          {metadata.exif && (
            <div className="mb-3">
              <div className="mb-2 text-xs font-medium" style={{ color: "var(--info)" }}>{t('organize.exifData')}</div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {metadata.exif.camera_make && <CardRow label={t('organize.make')} rightValue={metadata.exif.camera_make} />}
                {metadata.exif.camera_model && <CardRow label={t('organize.model')} rightValue={metadata.exif.camera_model} />}
                {metadata.exif.date_taken && <CardRow label={t('organize.dateTaken')} rightValue={metadata.exif.date_taken} />}
                {metadata.exif.gps && <CardRow label={t('organize.gps')} rightValue={metadata.exif.gps} />}
                {metadata.exif.exposure && <CardRow label={t('organize.exposure')} rightValue={metadata.exif.exposure} />}
              </div>
            </div>
          )}
          {metadata.audio && (
            <div>
              <div className="mb-2 text-xs font-medium" style={{ color: "var(--success)" }}>{t('organize.audioTags')}</div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {metadata.audio.artist && <CardRow label={t('organize.artist')} rightValue={metadata.audio.artist} />}
                {metadata.audio.album && <CardRow label={t('organize.album')} rightValue={metadata.audio.album} />}
                {metadata.audio.title && <CardRow label={t('organize.trackTitle')} rightValue={metadata.audio.title} />}
                {metadata.audio.genre && <CardRow label={t('organize.genre')} rightValue={metadata.audio.genre} />}
              </div>
            </div>
          )}
          {!metadata.exif && !metadata.audio && <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{t('organize.noMetadata')}</p>}
        </Card>
      )}
    </div>
  );
}
