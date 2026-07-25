import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentWebview } from "@tauri-apps/api/webview";

interface DropZoneProps {
  onFilesDropped: (paths: string[]) => void;
}

export default function DropZone({ onFilesDropped }: DropZoneProps) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    // Only hide if leaving the window
    if (e.relatedTarget === null) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      // Tauri v2 extends DragEvent with paths property
      const dragEvent = e as DragEvent & { paths?: string[] };
      if (dragEvent.paths && dragEvent.paths.length > 0) {
        onFilesDropped(dragEvent.paths);
      }
    },
    [onFilesDropped],
  );

  useEffect(() => {
    const webview = getCurrentWebview();

    // Listen for Tauri native drag-drop events
    const unlisten = webview.onDragDropEvent((event) => {
      if (event.payload.type === "enter" || event.payload.type === "over") {
        setIsDragging(true);
      } else if (event.payload.type === "drop") {
        setIsDragging(false);
        const paths = event.payload.paths;
        if (paths.length > 0) {
          onFilesDropped(paths);
        }
      } else if (event.payload.type === "leave") {
        setIsDragging(false);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [onFilesDropped]);

  // Also support HTML5 drag events as fallback
  useEffect(() => {
    const el = document.documentElement;
    el.addEventListener("dragover", handleDragOver);
    el.addEventListener("dragleave", handleDragLeave);
    el.addEventListener("drop", handleDrop);

    return () => {
      el.removeEventListener("dragover", handleDragOver);
      el.removeEventListener("dragleave", handleDragLeave);
      el.removeEventListener("drop", handleDrop);
    };
  }, [handleDragOver, handleDragLeave, handleDrop]);

  return (
    <AnimatePresence>
      {isDragging && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed px-16 py-12"
            style={{
              borderColor: "var(--accent)",
              backgroundColor: "var(--accent-soft)",
            }}
          >
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ backgroundColor: "var(--accent-soft)" }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--accent)" }}
              >
                <path d="M12 5v14M5 12l7-7 7 7" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                {t("dropZone.dropFiles")}
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                {t("dropZone.filesAddedToOrganize")}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
