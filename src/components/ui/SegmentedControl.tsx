interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[] | string[];
  value: T;
  onChange: (value: T) => void;
  layoutId?: string;
  size?: string;
}

function normalizeOptions<T extends string>(
  options: { value: T; label: string }[] | string[],
): { value: T; label: string }[] {
  if (typeof options[0] === 'string') {
    return (options as string[]).map((label) => ({ value: label as T, label }));
  }
  return options as { value: T; label: string }[];
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const opts = normalizeOptions<T>(options);
  return (
    <div className="inline-flex gap-0.5 rounded-pill border border-border bg-bg p-0.5">
      {opts.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={[
              'rounded-[6px] px-4 py-[7px] text-[12.5px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
              active
                ? 'bg-card text-text shadow-card font-semibold'
                : 'text-text-dim hover:text-text',
            ].join(' ')}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
