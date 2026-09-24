import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#eaf1fb",
        muted: "#91a0b5",
        brand: "#55aaff",
        canvas: "#0b111a",
      },
      boxShadow: {
        soft: "0 10px 28px rgba(0, 0, 0, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
