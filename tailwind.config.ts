import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#f1f5f9",
        muted: "#64748b",
        brand: {
          DEFAULT: "#2563eb",
          hover: "#3b82f6",
          subtle: "#1d4ed8",
        },
        canvas: "#06080d",
        surface: {
          DEFAULT: "#080c14",
          raised: "#0d131d",
          hover: "#111824",
        },
      },
      boxShadow: {
        soft: "0 4px 16px rgba(0, 0, 0, 0.4)",
        dropdown: "0 8px 24px rgba(0, 0, 0, 0.6)",
      },
    },
  },
  plugins: [],
};

export default config;
