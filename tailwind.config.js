/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Geist",
          "Segoe UI",
          "sans-serif",
        ],
      },
      colors: {
        // ── New native design tokens (from tailwind.tokens.js) ──
        bg: "var(--color-bg)",
        "bg-app": "var(--color-bg)",
        sidebar: "var(--color-sidebar)",
        card: "var(--color-card)",
        border: {
          DEFAULT: "var(--color-border)",
          strong: "var(--color-border-strong)",
        },
        text: {
          DEFAULT: "var(--color-text)",
          dim: "var(--color-text-dim)",
          faint: "var(--color-text-faint)",
          // Legacy aliases
          primary: "var(--color-text)",
          secondary: "var(--color-text-dim)",
          tertiary: "var(--color-text-faint)",
          inverse: "var(--color-accent-contrast)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          soft: "var(--color-accent-soft)",
          contrast: "var(--color-accent-contrast)",
          hover: "var(--color-accent)",
        },
        success: "var(--color-success)",
        danger: "var(--color-danger)",
        warning: "var(--color-warning)",
        info: "var(--color-accent)",
        icon: {
          organize: "var(--icon-organize)",
          rules: "var(--icon-rules)",
          duplicates: "var(--icon-duplicates)",
          history: "var(--icon-history)",
          settings: "var(--icon-settings)",
        },
        // Legacy surface aliases
        "card-hover": "var(--color-card)",
        inset: "var(--color-bg)",
        elevated: "var(--color-card)",
        "border-focus": "var(--color-accent)",
        // Legacy afo compat
        afo: {
          purple: "var(--color-accent)",
          emerald: "var(--color-success)",
          amber: "var(--color-warning)",
          rose: "var(--color-danger)",
          sky: "var(--color-accent)",
        },
      },
      borderRadius: {
        card: "12px",
        pill: "8px",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        popover: "var(--shadow-popover)",
        sm: "var(--shadow-card)",
        md: "var(--shadow-popover)",
        lg: "var(--shadow-popover)",
      },
    },
  },
  plugins: [],
};
