import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { ink: "#1B2A30", muted: "#4F5F66", line: "#D8DEE0", brand: { DEFAULT: "#1F4E5F", deep: "#163A47", soft: "#E7EFF1" }, sand: "#F6F1E8", paper: "#FBFAF7", now: { DEFAULT: "#A23B2C", soft: "#F8E9E6" }, soon: { DEFAULT: "#8A5A10", soft: "#F7EEDC" }, ahead: { DEFAULT: "#2D6A55", soft: "#E5F1EC" }, gold: "#E0A458" },
      fontFamily: { body: ["var(--ff-body)", "Arial", "sans-serif"], display: ["var(--ff-display)", "Georgia", "serif"], mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"] },
      boxShadow: { card: "0 1px 2px rgb(27 42 48 / .05), 0 10px 24px -18px rgb(27 42 48 / .35)" },
    },
  },
  plugins: [],
} satisfies Config;
