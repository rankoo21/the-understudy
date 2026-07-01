import type { Config } from "tailwindcss";

// The Understudy palette: a gunmetal instrument room with signal accents.
// Signal cyan is reserved for accepted / consistent. Hazard amber is reserved
// for quarantine / contradiction. Never use them interchangeably.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        console: {
          black: "#0A0B0D",
          gunmetal: "#1C2024",
          graphite: "#2E343A",
        },
        instrument: {
          white: "#D8DEE4",
          steel: "#5A7184",
          label: "#8A929A",
        },
        signal: {
          cyan: "#38E1D6",
          amber: "#E8A53C",
        },
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        machine: ["var(--font-machine)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "ticker-roll": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "led-blink": {
          "0%, 100%": { opacity: "0.25" },
          "50%": { opacity: "1" },
        },
        "scan-sweep": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "10%": { opacity: "1" },
          "90%": { opacity: "1" },
          "100%": { transform: "translateY(100%)", opacity: "0" },
        },
        "core-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "ticker-roll": "ticker-roll 38s linear infinite",
        "led-blink": "led-blink 1.6s steps(2, end) infinite",
        "scan-sweep": "scan-sweep 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        "core-spin": "core-spin 60s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
