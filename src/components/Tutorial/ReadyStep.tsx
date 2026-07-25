import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function ReadyStep() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center text-center">
      {/* Celebration Icon */}
      <div
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl"
        style={{ backgroundColor: "var(--accent-soft)" }}
      >
        <Sparkles
          size={40}
          style={{ color: "var(--accent)" }}
          strokeWidth={1.5}
        />
      </div>

      <h2
        className="mb-3 text-2xl font-bold"
        style={{ color: "var(--text-primary)" }}
      >
        {t("tutorial.youReady")}
      </h2>

      <p
        className="max-w-sm text-base leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        {t("tutorial.startOrganizing")}
      </p>
    </div>
  );
}