import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { FileInfo } from "../../lib/tauri-bridge";

type Mode = "extension" | "date" | "rename";

interface PreviewItem {
  fileName: string;
  sourcePath: string;
  destination: string;
  actionType: "move" | "rename" | "skip";
  category?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  images: "text-afo-sky",
  documents: "text-afo-amber",
  audio: "text-afo-purple",
  video: "text-afo-rose",
  archives: "text-text-secondary",
  code: "text-afo-emerald",
  other: "text-text-tertiary",
};

const EXT_TO_CATEGORY: Record<string, string> = {
  jpg: "images",
  jpeg: "images",
  png: "images",
  gif: "images",
  bmp: "images",
  svg: "images",
  webp: "images",
  heic: "images",
  pdf: "documents",
  doc: "documents",
  docx: "documents",
  txt: "documents",
  rtf: "documents",
  odt: "documents",
  mp3: "audio",
  wav: "audio",
  flac: "audio",
  aac: "audio",
  ogg: "audio",
  m4a: "audio",
  mp4: "video",
  mkv: "video",
  avi: "video",
  mov: "video",
  wmv: "video",
  flv: "video",
  zip: "archives",
  tar: "archives",
  gz: "archives",
  rar: "archives",
  "7z": "archives",
  rs: "code",
  py: "code",
  js: "code",
  ts: "code",
  go: "code",
  c: "code",
  cpp: "code",
  h: "code",
};

function getCategorize(ext: string): string {
  return EXT_TO_CATEGORY[ext.toLowerCase()] || "other";
}

interface PreviewPaneProps {
  files: FileInfo[];
  mode: Mode;
  dirPath: string;
  dateFormat?: "yearmonth" | "fulldate";
  renamePattern?: string;
}

export default function PreviewPane({
  files,
  mode,
  dirPath,
  dateFormat = "yearmonth",
  renamePattern = "",
}: PreviewPaneProps) {
  const { t } = useTranslation();
  const previewItems = useMemo(() => {
    const items: PreviewItem[] = [];
    let counter = 1;

    for (const file of files) {
      if (file.is_dir) {
        items.push({
          fileName: file.name,
          sourcePath: file.path,
          destination: file.path,
          actionType: "skip",
        });
        continue;
      }

      switch (mode) {
        case "extension": {
          const category = getCategorize(file.extension);
          const dest = `${dirPath}/${category}/${file.name}`;
          items.push({
            fileName: file.name,
            sourcePath: file.path,
            destination: dest,
            actionType: "move",
            category,
          });
          break;
        }
        case "date": {
          // Use modified date for preview (backend uses EXIF for images)
          const modified = new Date();
          const year = modified.getFullYear();
          const month = String(modified.getMonth() + 1).padStart(2, "0");
          const folder =
            dateFormat === "fulldate"
              ? `${year}/${month}/${String(modified.getDate()).padStart(2, "0")}`
              : `${year}/${month}`;
          const dest = `${dirPath}/${folder}/${file.name}`;
          items.push({
            fileName: file.name,
            sourcePath: file.path,
            destination: dest,
            actionType: "move",
          });
          break;
        }
        case "rename": {
          if (!renamePattern) {
            items.push({
              fileName: file.name,
              sourcePath: file.path,
              destination: file.path,
              actionType: "skip",
            });
            break;
          }
          const nameNoExt = file.name.replace(new RegExp(`\\.${file.extension}$`), "");
          const newName = renamePattern
            .replace("{name}", nameNoExt)
            .replace("{ext}", file.extension)
            .replace("{counter}", String(counter));
          const dest = `${dirPath}/${newName}`;
          items.push({
            fileName: file.name,
            sourcePath: file.path,
            destination: dest,
            actionType: newName !== file.name ? "rename" : "skip",
          });
          counter++;
          break;
        }
      }
    }

    return items;
  }, [files, mode, dirPath, dateFormat, renamePattern]);

  // Group by category for extension mode
  const grouped = useMemo(() => {
    if (mode !== "extension") return null;

    const groups: Record<string, PreviewItem[]> = {};
    for (const item of previewItems) {
      const cat = item.category || "other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [previewItems, mode]);

  const totalActions = previewItems.filter((i) => i.actionType !== "skip").length;
  const totalSkipped = previewItems.filter((i) => i.actionType === "skip").length;

  return (
    <div className="rounded-xl p-5" style={{ border: "1px solid var(--border-default)", backgroundColor: "var(--bg-inset)" }}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{t("preview.livePreview")}</h3>
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          {totalActions} {mode === "rename" ? t("preview.toRename") : t("preview.toMove")}
          {totalSkipped > 0 && `, ${t("preview.skipped", { count: totalSkipped })}`}
        </span>
      </div>

      {previewItems.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{t("preview.noFilesToPreview")}</p>
      ) : grouped ? (
        // Extension mode — grouped by category
        <div className="space-y-3">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={`text-xs font-medium ${CATEGORY_COLORS[category] || "text-white/50"}`}
                >
                  {category}
                </span>
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{items.length} {t("preview.files")}</span>
              </div>
              <div className="ml-2 space-y-0.5">
                {items.map((item) => (
                  <PreviewRow key={item.sourcePath} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Date or rename mode — flat list
        <div className="space-y-0.5">
          {previewItems.map((item) => (
            <PreviewRow key={item.sourcePath} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function PreviewRow({ item }: { item: PreviewItem }) {
  const isSkipped = item.actionType === "skip";
  const isRename = item.actionType === "rename";

  return (
    <div
      className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs ${
        isSkipped ? "opacity-40" : ""
      }`}
    >
      <span className="min-w-0 shrink truncate" style={{ color: "var(--text-primary)" }}>{item.fileName}</span>
      {!isSkipped && (
        <>
          <span className="shrink-0" style={{ color: "var(--text-tertiary)" }}>
            {isRename ? (
              <RenameArrow />
            ) : (
              <MoveArrow />
            )}
          </span>
          <span
            className={`min-w-0 shrink truncate ${
              isRename ? "text-afo-amber" : "text-afo-emerald"
            }`}
          >
            {getShortDest(item.destination)}
          </span>
        </>
      )}
    </div>
  );
}

function getShortDest(dest: string): string {
  // Show last 2-3 path segments
  const parts = dest.split("/").filter(Boolean);
  if (parts.length <= 2) return dest;
  return `…/${parts.slice(-2).join("/")}`;
}

function MoveArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="inline-block">
      <path
        d="M3 7h8m0 0L8 4m3 3L8 10"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RenameArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="inline-block">
      <path
        d="M2 10l6-6m0 0h-3m3 0v3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
