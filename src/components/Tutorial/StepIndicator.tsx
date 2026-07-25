import { motion } from "framer-motion";

interface StepIndicatorProps {
  current: number;
  total: number;
}

export default function StepIndicator({ current, total }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2" role="presentation" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="relative h-2 w-2 rounded-full transition-colors duration-200"
          style={{
            backgroundColor:
              i === current
                ? "var(--accent)"
                : "var(--border-default)",
          }}
        >
          {i === current && (
            <motion.div
              layoutId="step-indicator"
              className="absolute inset-0 rounded-full"
              style={{ backgroundColor: "var(--accent)" }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
            />
          )}
        </div>
      ))}
    </div>
  );
}