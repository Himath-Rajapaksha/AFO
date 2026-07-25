import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import { type PendingAction, approvePendingAction, rejectPendingAction, approveAllPending, rejectAllPending } from "../../lib/tauri-bridge";
import Button from "../ui/Button";

interface Props {
  actions: PendingAction[];
  onRefresh: () => void;
}

export default function PendingActions({ actions, onRefresh }: Props) {
  const { t } = useTranslation("capture");
  const [acting, setActing] = useState(false);

  async function handleApprove(id: number) {
    setActing(true);
    try {
      await approvePendingAction(id);
      onRefresh();
    } finally {
      setActing(false);
    }
  }

  async function handleReject(id: number) {
    setActing(true);
    try {
      await rejectPendingAction(id);
      onRefresh();
    } finally {
      setActing(false);
    }
  }

  async function handleApproveAll() {
    setActing(true);
    try {
      await approveAllPending();
      onRefresh();
    } finally {
      setActing(false);
    }
  }

  async function handleRejectAll() {
    setActing(true);
    try {
      await rejectAllPending();
      onRefresh();
    } finally {
      setActing(false);
    }
  }

  if (actions.length === 0) {
    return (
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-inset)", border: "1px solid var(--border-default)" }}>
        <p className="text-xs text-center" style={{ color: "var(--text-tertiary)" }}>{t("capture:noPendingActions")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--bg-inset)", border: "1px solid var(--border-default)" }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {actions.length} pending action{actions.length !== 1 ? "s" : ""}
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleApproveAll} disabled={acting} className="text-xs px-2 py-1">
            {t("capture:approveAll")}
          </Button>
          <Button variant="danger" onClick={handleRejectAll} disabled={acting} className="text-xs px-2 py-1 opacity-70 hover:opacity-100">
            {t("capture:rejectAll")}
          </Button>
        </div>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {actions.map((action) => {
          const srcName = action.source_path.split(/[\\/]/).pop() || action.source_path;
          const dstName = action.dest_path.split(/[\\/]/).pop() || action.dest_path;
          return (
            <div key={action.id} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }}>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{srcName}</div>
                <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  → {dstName}
                  {action.rule_name && <span style={{ color: "var(--accent)" }}> ({action.rule_name})</span>}
                </div>
              </div>
              <button onClick={() => handleApprove(action.id)} disabled={acting} className="p-1 rounded" style={{ color: "var(--success)" }} aria-label={t("capture:approve", { name: srcName })}>
                <Check size={14} />
              </button>
              <button onClick={() => handleReject(action.id)} disabled={acting} className="p-1 rounded" style={{ color: "var(--danger)" }} aria-label={t("capture:reject", { name: srcName })}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
