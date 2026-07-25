import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../lib/store";
import WelcomeStep from "../Tutorial/WelcomeStep";
import QuickStartStep from "../Tutorial/QuickStartStep";
import FeaturesStep from "../Tutorial/FeaturesStep";
import HowItWorksStep from "../Tutorial/HowItWorksStep";
import TipsStep from "../Tutorial/TipsStep";
import ReadyStep from "../Tutorial/ReadyStep";
import { dismissTutorial } from "../Tutorial";

const TOTAL_STEPS = 6;

const steps = [
  WelcomeStep,
  QuickStartStep,
  FeaturesStep,
  HowItWorksStep,
  TipsStep,
  ReadyStep,
];

export default function TutorialPanel() {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const setActivePanel = useAppStore((s) => s.setActivePanel);

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS - 1) setCurrentStep((s) => s + 1);
  };

  const handleFinish = () => {
    dismissTutorial();
    setActivePanel("organize");
  };

  const handleSkip = () => {
    setActivePanel("organize");
  };

  const StepComponent = steps[currentStep];
  const isLastStep = currentStep === TOTAL_STEPS - 1;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top bar: Skip */}
      <div className="flex justify-end px-8 pt-6">
        {!isLastStep && (
          <button
            onClick={handleSkip}
            className="text-xs transition-colors"
            style={{ color: "var(--text-tertiary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
          >
            {t("common.skip")}
          </button>
        )}
      </div>

      {/* Content — no scroll, centered */}
      <div className="flex flex-1 items-center justify-center px-8">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              <StepComponent />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom: dots + button */}
      <div className="flex flex-col items-center gap-5 pb-10">
        {/* Dot seek bar */}
        <div className="flex items-center gap-2.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(i)}
              aria-label={t("tutorial.goToStep", { step: i + 1 })}
              aria-current={i === currentStep ? "step" : undefined}
              className="h-2.5 w-2.5 rounded-full transition-all duration-200"
              style={{
                backgroundColor: i === currentStep ? "var(--accent)" : "var(--border-default)",
                transform: i === currentStep ? "scale(1.25)" : "scale(1)",
              }}
            />
          ))}
        </div>

        {/* Action button */}
        {isLastStep ? (
          <button
            onClick={handleFinish}
            className="rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-inverse)" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            {t("tutorial.startOrganizingBtn")}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-inverse)" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            {t("common.next")}
          </button>
        )}
      </div>
    </div>
  );
}
