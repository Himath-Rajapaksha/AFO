import { useRef, useState, useEffect, useCallback } from 'react';
import './SegmentedControl.css';

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[] | string[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  layoutId?: string;
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
  size = 'sm',
}: SegmentedControlProps<T>) {
  const opts = normalizeOptions<T>(options);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLLabelElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const measure = useCallback(() => {
    const activeIdx = Math.max(0, opts.findIndex((o) => o.value === value));
    const btn = btnRefs.current[activeIdx];
    if (!btn) return;

    const wrap = wrapRef.current?.querySelector('.di-radio-island') as HTMLElement | null;
    if (!wrap) return;

    const islandRect = wrap.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setIndicator({
      left: btnRect.left - islandRect.left,
      width: btnRect.width,
    });
  }, [opts, value]);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const groupName = opts.map((o) => o.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')).join('-');

  return (
    <div
      ref={wrapRef}
      className={`di-radio-wrap ${size === 'sm' ? 'di-radio-wrap--sm' : ''}`}
    >
      {opts.map((opt, i) => (
        <input
          key={opt.value}
          type="radio"
          name={groupName}
          id={`di-${groupName}-${i}`}
          className="di-radio-input"
          checked={opt.value === value}
          onChange={() => onChange(opt.value)}
        />
      ))}

      <div className="di-radio-island">
        {opts.map((opt, i) => (
          <label
            key={opt.value}
            ref={(el) => { btnRefs.current[i] = el; }}
            className="di-radio-btn"
            htmlFor={`di-${groupName}-${i}`}
            aria-pressed={opt.value === value}
          >
            {opt.label}
          </label>
        ))}
        <div
          className="di-radio-indicator"
          style={{
            transform: `translateX(${indicator.left - 3}px)`,
            width: indicator.width,
          }}
        />
      </div>
    </div>
  );
}

export default SegmentedControl;
