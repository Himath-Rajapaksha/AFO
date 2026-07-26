import type { ReactNode } from "react";

/* ── Card ────────────────────────────────────────────────────────────── */

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-card border p-5 ${className}`}
      style={{
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--border-default)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {children}
    </div>
  );
}

/* ── CardHeader ──────────────────────────────────────────────────────── */

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className = "" }: CardHeaderProps) {
  return (
    <h3
      className={`mb-1 text-sm font-semibold ${className}`}
      style={{ color: "var(--text-primary)" }}
    >
      {children}
    </h3>
  );
}

/* ── CardDescription ─────────────────────────────────────────────────── */

interface CardDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function CardDescription({ children, className = "" }: CardDescriptionProps) {
  return (
    <p className={`mb-4 text-xs ${className}`} style={{ color: "var(--text-secondary)" }}>
      {children}
    </p>
  );
}

/* ── CardRow ─────────────────────────────────────────────────────────── */

interface CardRowProps {
  children?: ReactNode;
  className?: string;
  label?: string;
  description?: string;
  control?: ReactNode;
  rightValue?: string;
}

export function CardRow({ children, className = "", label, description, control, rightValue }: CardRowProps) {
  // If label/control props are used, render the structured layout
  if (label || control || rightValue) {
    return (
      <div
        className={`flex items-center justify-between gap-4 py-3 ${className}`}
        style={{ borderBottom: "1px solid var(--border-default)" }}
      >
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {label}
          </div>
          {description && (
            <div className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              {description}
            </div>
          )}
        </div>
        {control && <div className="shrink-0">{control}</div>}
        {rightValue && !control && (
          <div className="shrink-0 text-sm" style={{ color: "var(--text-secondary)" }}>
            {rightValue}
          </div>
        )}
      </div>
    );
  }
  // Legacy: children-based layout
  return (
    <div
      className={`flex items-center justify-between gap-4 py-3 ${className}`}
      style={{ borderBottom: "1px solid var(--border-default)" }}
    >
      {children}
    </div>
  );
}

/* ── CardFooter ──────────────────────────────────────────────────────── */

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className = "" }: CardFooterProps) {
  return (
    <div
      className={`mt-4 flex items-center gap-3 ${className}`}
      style={{ borderTop: "1px solid var(--border-default)", paddingTop: 12 }}
    >
      {children}
    </div>
  );
}
