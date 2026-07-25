import { FolderOpen, GitBranch, Copy, Radio } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function FeaturesStep() {
  const { t } = useTranslation();

  const features = [
    {
      icon: FolderOpen,
      title: t("sidebar.organize"),
      description: t("tutorial.featureOrganize"),
    },
    {
      icon: GitBranch,
      title: t("sidebar.rules"),
      description: t("tutorial.featureRuleBuilder"),
    },
    {
      icon: Copy,
      title: t("sidebar.duplicates"),
      description: t("tutorial.featureDuplicates"),
    },
    {
      icon: Radio,
      title: t("sidebar.capture"),
      description: t("tutorial.featureLiveCapture"),
    },
  ];

  return (
    <div>
      <h2
        className="mb-2 text-xl font-bold"
        style={{ color: "var(--text-primary)" }}
      >
        {t("tutorial.coreFeatures")}
      </h2>

      <p
        className="mb-6 text-sm"
        style={{ color: "var(--text-secondary)" }}
      >
        {t("tutorial.everythingYouNeed")}
      </p>

      <div className="space-y-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
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
              <div>
                <h3
                  className="text-sm font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {feature.title}
                </h3>
                <p
                  className="text-xs"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {feature.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
