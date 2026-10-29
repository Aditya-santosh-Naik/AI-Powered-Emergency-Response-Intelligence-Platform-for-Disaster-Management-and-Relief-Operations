/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        qc: {
          bg: "#0A101C",
          sidebar: "#0D1424",
          "surface-1": "#111A2D",
          "surface-2": "#17233A",
          "surface-3": "#1D2B46",
          "border-subtle": "#223050",
          "border-strong": "#33466F",
          "text-primary": "#E8EEF9",
          "text-secondary": "#A3B3CF",
          "text-tertiary": "#7686A3",
          "text-disabled": "#5A6985",
          accent: "#38BDF8",
          "accent-hover": "#7DD3FC",
          "accent-contrast": "#06121F",
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
    },
  },
  plugins: [],
}
