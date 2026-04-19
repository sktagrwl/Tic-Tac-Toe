/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        "oxo-bg":        "#000000",
        "oxo-bg-soft":   "#080808",
        "oxo-surface":   "#111111",
        "oxo-surface-2": "#1a1a1a",
        "oxo-surface-3": "#222222",
        "oxo-border":    "#2a2a2a",
        "oxo-border-2":  "#333333",
        "oxo-x":         "#00d4ff",
        "oxo-o":         "#ff006e",
        "oxo-accent":    "#7c3aed",
        "oxo-accent-2":  "#8b5cf6",
        "oxo-text":      "#ffffff",
        "oxo-muted":     "#a1a1aa",
        "oxo-faint":     "#52525b",
      },
      maxWidth: {
        "oxo-board": "360px",
      },
      keyframes: {
        "glow-x": {
          "0%, 100%": { boxShadow: "0 0 8px 2px rgba(0, 212, 255, 0.4)" },
          "50%":       { boxShadow: "0 0 20px 6px rgba(0, 212, 255, 0.7)" },
        },
        "glow-o": {
          "0%, 100%": { boxShadow: "0 0 8px 2px rgba(255, 0, 110, 0.4)" },
          "50%":       { boxShadow: "0 0 20px 6px rgba(255, 0, 110, 0.7)" },
        },
        "fade-in": {
          "0%":   { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scan-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%":       { opacity: "1" },
        },
        "glow-text-x": {
          "0%, 100%": { textShadow: "0 0 18px rgba(0,212,255,0.55)" },
          "50%":       { textShadow: "0 0 35px rgba(0,212,255,1), 0 0 55px rgba(0,212,255,0.45)" },
        },
        "glow-text-o": {
          "0%, 100%": { textShadow: "0 0 18px rgba(255,0,110,0.55)" },
          "50%":       { textShadow: "0 0 35px rgba(255,0,110,1), 0 0 55px rgba(255,0,110,0.45)" },
        },
      },
      animation: {
        "glow-x":       "glow-x 1.6s ease-in-out infinite",
        "glow-o":       "glow-o 1.6s ease-in-out infinite",
        "fade-in":      "fade-in 0.15s ease-out forwards",
        "fade-up":      "fade-up 0.25s ease-out forwards",
        "scan-pulse":   "scan-pulse 1.4s ease-in-out infinite",
        "glow-text-x":  "glow-text-x 2.5s ease-in-out infinite",
        "glow-text-o":  "glow-text-o 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}
