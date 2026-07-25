import { FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function WelcomeStep() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center text-center">
      {/* Logo / Icon */}
      <div
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl"
        style={{ backgroundColor: "var(--accent-soft)" }}
      >
        <FolderOpen
          size={40}
          style={{ color: "var(--accent)" }}
          strokeWidth={1.5}
        />
      </div>

      <h2
        className="mb-3 text-2xl font-bold"
        style={{ color: "var(--text-primary)" }}
      >
        {t("tutorial.welcome")}
      </h2>

      <p
        className="max-w-sm text-base leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        {t("tutorial.welcomeDesc")}
      </p>
    </div>
  );
}