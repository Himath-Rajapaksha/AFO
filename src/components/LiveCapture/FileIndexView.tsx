import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { type IndexedFile, searchFileIndex } from "../../lib/tauri-bridge";
import { inputCls } from "../ui/input";

const inputStyle = { backgroundColor: "var(--bg-inset)", border: "1px solid var(--border-default)", color: "var(--text-primary)" };

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function FileIndexView() {
  const { t } = useTranslation(["capture", "common"]);
  const [query, setQuery] = useState("");
  const [extFilter, setExtFilter] = useState("");
  const [results, setResults] = useState<IndexedFile[]>([]);
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(async () => {
    setLoading(true);
    try {
      const files = await searchFileIndex(query, extFilter || undefined, 50);
      setResults(files);
    } finally {
      setLoading(false);
    }
  }, [query, extFilter]);

  useEffect(() => {
    const timer = setTimeout(doSearch, 300);
    return () => clearTimeout(timer);
  }, [doSearch]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("capture:searchFiles")}
            className={`w-full pl-8 ${inputCls}`}
            style={inputStyle}
          />
        </div>
        <input
          type="text"
          value={extFilter}
          onChange={(e) => setExtFilter(e.target.value)}
          placeholder={t("capture:extension")}
          className={`w-24 ${inputCls}`}
          style={inputStyle}
        />
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ backgroundColor: "var(--bg-inset)" }}>
              <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--text-secondary)" }}>Name</th>
              <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--text-secondary)" }}>Ext</th>
              <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--text-secondary)" }}>Size</th>
              <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--text-secondary)" }}>{t("capture:modified")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-3 py-4 text-center" style={{ color: "var(--text-tertiary)" }}>{t("common:searching")}</td></tr>
            ) : results.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-4 text-center" style={{ color: "var(--text-tertiary)" }}>{t("common:noResults")}</td></tr>
            ) : (
              results.map((file) => (
                <tr key={file.id} style={{ borderTop: "1px solid var(--border-default)" }}>
                  <td className="px-3 py-2 truncate max-w-[200px]" style={{ color: "var(--text-primary)" }} title={file.path}>{file.filename}</td>
                  <td className="px-3 py-2" style={{ color: "var(--text-tertiary)" }}>{file.extension}</td>
                  <td className="px-3 py-2" style={{ color: "var(--text-secondary)" }}>{formatBytes(file.size)}</td>
                  <td className="px-3 py-2" style={{ color: "var(--text-tertiary)" }}>{new Date(file.modified_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
