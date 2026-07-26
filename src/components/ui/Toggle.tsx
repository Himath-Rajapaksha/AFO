import './Toggle.css';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

/**
 * Galahhad checkmark/cross switch — CSS-based with SVG icons.
 * role="switch" + aria-checked for screen reader accessibility.
 */
export function Toggle({ checked, onChange, label, disabled, size = 'md' }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      style={{ background: 'none', border: 'none', padding: 0 }}
    >
      <label className={`afo-toggle ${size === 'sm' ? 'afo-toggle--sm' : ''}`} style={{ opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? 'none' : undefined }}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          tabIndex={-1}
          readOnly
        />
        <div className="afo-slider">
          <div className="afo-circle">
            <svg className="afo-cross" viewBox="0 0 365.696 365.696" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M243.188 182.86 356.32 69.726c12.5-12.5 12.5-32.766 0-45.247L341.238 9.398c-12.504-12.503-32.77-12.503-45.25 0L182.86 122.528 69.727 9.374c-12.5-12.5-32.766-12.5-45.247 0L9.375 24.457c-12.5 12.504-12.5 32.77 0 45.25l113.152 113.152L9.398 295.99c-12.503 12.503-12.503 32.769 0 45.25L24.48 356.32c12.5 12.5 32.766 12.5 45.247 0l113.132-113.132L295.99 356.32c12.503 12.5 32.769 12.5 45.25 0l15.081-15.082c12.5-12.504 12.5-32.77 0-45.25zm0 0" />
            </svg>
            <svg className="afo-checkmark" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M9.707 19.121a.997.997 0 0 1-1.414 0l-5.646-5.647a1.5 1.5 0 0 1 0-2.121l.707-.707a1.5 1.5 0 0 1 2.121 0L9 14.171l9.525-9.525a1.5 1.5 0 0 1 2.121 0l.707.707a1.5 1.5 0 0 1 0 2.121z" />
            </svg>
          </div>
        </div>
      </label>
    </button>
  );
}

export default Toggle;
