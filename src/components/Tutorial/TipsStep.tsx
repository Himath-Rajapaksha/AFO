import { Command, Undo2, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function TipsStep() {
  const { t } = useTranslation();

  const tips = [
    {
      icon: Command,
      shortcut: "Cmd/Ctrl + K",
      title: t("tutorial.commandPalette"),
      description: t("tutorial.commandPaletteDesc"),
    },
    {
      icon: Undo2,
      shortcut: "⌘Z",
      title: t("tutorial.undoAnytimeTip"),
      description: t("tutorial.undoAnytimeTipDesc"),
    },
    {
      icon: Settings,
      shortcut: "Settings",
      title: t("tutorial.customize"),
      description: t("tutorial.customizeDesc"),
    },
  ];

  return (
    <div>
      <h2
        className="mb-2 text-xl font-bold"
        style={{ color: "var(--text-primary)" }}
      >
        {t("tutorial.tipsAndTricks")}
      </h2>

      <p
        className="mb-6 text-sm"
        style={{ color: "var(--text-secondary)" }}
      >
        {t("tutorial.powerUserShortcuts")}
      </p>

      <div className="space-y-3">
        {tips.map((tip) => {
          const Icon = tip.icon;
          return (
            <div
              key={tip.title}
              className="flex items-center gap-4 rounded-xl p-3"
              style={{
                backgroundColor: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
              }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: "var(--accent-soft)" }}
              >
                <Icon
                  size={20}
                  style={{ color: "var(--accent)" }}
                  strokeWidth={1.5}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3
                    className="text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {tip.title}
                  </h3>
                  <span
                    className="rounded px-1.5 py-0.5 text-xs font-mono"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      color: "var(--text-tertiary)",
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    {tip.shortcut}
                  </span>
                </div>
                <p
                  className="text-xs"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {tip.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
