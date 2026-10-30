/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        qc: {
          bg: "var(--bg-app)",
          sidebar: "var(--bg-sidebar)",
          "surface-1": "var(--surface-1)",
          "surface-2": "var(--surface-2)",
          "surface-3": "var(--surface-3)",
          "border-subtle": "var(--border-subtle)",
          "border-strong": "var(--border-strong)",
          "text-primary": "var(--text-primary)",
          "text-secondary": "var(--text-secondary)",
          "text-tertiary": "var(--text-tertiary)",
          "text-disabled": "var(--text-disabled)",
          accent: "var(--accent)",
          "accent-hover": "var(--accent-hover)",
          "accent-contrast": "var(--accent-contrast)",
        },
        glass: {
          // Dark theme glass
          "dark-bg": "rgba(15, 23, 42, 0.72)",
          "dark-card": "rgba(22, 34, 58, 0.65)",
          "dark-hover": "rgba(30, 48, 80, 0.75)",
          "dark-border": "rgba(255, 255, 255, 0.12)",
          "dark-border-strong": "rgba(255, 255, 255, 0.2)",

          // Light theme glass
          "light-bg": "rgba(255, 255, 255, 0.82)",
          "light-card": "rgba(255, 255, 255, 0.75)",
          "light-hover": "rgba(255, 255, 255, 0.92)",
          "light-border": "rgba(255, 255, 255, 0.7)",
          "light-border-strong": "rgba(203, 213, 225, 0.8)",
        },
        severity: {
          low: "#34B27B",
          moderate: "#F5B83D",
          high: "#F97316",
          critical: "#EF4444",
          unknown: "#8391AB",
        },
        resource: {
          food: "#F59E0B",
          water: "#38BDF8",
          medical: "#EC4899",
          shelter: "#8B5CF6",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          '"SF Mono"',
          "Consolas",
          '"Liberation Mono"',
          "Menlo",
          "monospace",
        ],
      },
      boxShadow: {
        "glass-dark": "0 8px 32px 0 rgba(0, 0, 0, 0.4)",
        "glass-light": "0 8px 32px 0 rgba(31, 38, 135, 0.08)",
        "glass-sm": "0 4px 16px 0 rgba(0, 0, 0, 0.15)",
        "glass-glow": "0 0 20px rgba(56, 189, 248, 0.25)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
