import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import WelcomeStep from "./WelcomeStep";
import QuickStartStep from "./QuickStartStep";
import FeaturesStep from "./FeaturesStep";
import HowItWorksStep from "./HowItWorksStep";
import TipsStep from "./TipsStep";
import ReadyStep from "./ReadyStep";
import StepIndicator from "./StepIndicator";

const STORAGE_KEY = "afo-tutorial-dismissed";
const TOTAL_STEPS = 6;

const steps = [
  WelcomeStep,
  QuickStartStep,
  FeaturesStep,
  HowItWorksStep,
  TipsStep,
  ReadyStep,
];

interface TutorialProps {
  isOpen: boolean;
  onClose: () => void;
}

export function shouldShowTutorial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "true";
  } catch {
    return true;
  }
}

export function dismissTutorial() {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    /* ignore */
  }
}

export function resetTutorial() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export default function Tutorial({ isOpen, onClose }: TutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) setCurrentStep(0);
  }, [isOpen]);

  // Auto-focus close button on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        modalRef.current?.querySelector<HTMLElement>("button")?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Escape key to close + focus trap
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab") {
        const container = modalRef.current;
        if (!container) return;
        const focusables = container.querySelectorAll<HTMLElement>(
          'button, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleFinish = () => {
    dismissTutorial();
    onClose();
  };

  const StepComponent = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TOTAL_STEPS - 1;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100]"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
        >
          <div className="flex h-full items-center justify-center p-4">
            <motion.div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-label="Tutorial"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="relative w-full max-w-lg rounded-2xl p-8 shadow-2xl"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-default)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={onClose}
                aria-label="Close tutorial"
                className="absolute right-4 top-4 rounded-lg p-1.5 transition-colors"
                style={{ color: "var(--text-tertiary)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "var(--accent-soft)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                <X size={18} />
              </button>

              {/* Step content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <StepComponent />
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="mt-8 flex items-center justify-between">
                <StepIndicator current={currentStep} total={TOTAL_STEPS} />

                <div className="flex gap-3">
                  {!isFirstStep && (
                    <button
                      onClick={handlePrev}
                      className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                      style={{ color: "var(--text-secondary)" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          "var(--accent-soft)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                    >
                      Back
                    </button>
                  )}

                  {isLastStep ? (
                    <button
                      onClick={handleFinish}
                      className="rounded-lg px-5 py-2 text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: "var(--accent)",
                        color: "var(--text-inverse)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.opacity = "0.9")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.opacity = "1")
                      }
                    >
                      Start Organizing
                    </button>
                  ) : (
                    <button
                      onClick={handleNext}
                      className="rounded-lg px-5 py-2 text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: "var(--accent)",
                        color: "var(--text-inverse)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.opacity = "0.9")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.opacity = "1")
                      }
                    >
                      Next
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}