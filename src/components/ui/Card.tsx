import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`mb-5 rounded-card border border-border bg-card shadow-card ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-border px-[18px] py-3 text-[11.5px] font-semibold uppercase tracking-wide text-text-dim">
      {children}
    </div>
  );
}

export function CardDescription({ children }: { children: ReactNode }) {
  return (
    <div className="px-[18px] pb-3 text-[12.5px] text-text-dim">
      {children}
    </div>
  );
}

export function CardRow({
  children,
  className = '',
  label,
  description,
  control,
  rightValue,
}: {
  children?: ReactNode;
  className?: string;
  label?: string;
  description?: string;
  control?: ReactNode;
  rightValue?: string;
}) {
  // If label/control props are used, render the structured layout
  if (label || control || rightValue) {
    return (
      <div
        className={`flex items-center justify-between border-t border-border px-[18px] py-3.5 first:border-t-0 ${className}`}
      >
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-medium text-text">{label}</div>
          {description && (
            <div className="text-[12px] text-text-dim">{description}</div>
          )}
        </div>
        {control ?? (rightValue && (
          <span className="text-[12.5px] text-text-dim">{rightValue}</span>
        ))}
      </div>
    );
  }
  // Legacy: children-based layout
  return (
    <div
      className={`flex items-center justify-between border-t border-border px-[18px] py-3.5 first:border-t-0 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end gap-2.5 border-t border-border px-[18px] py-4">
      {children}
    </div>
  );
}
