import type { Config } from "tailwindcss";
import { BRAND } from "./src/lib/brand";

const c = BRAND.colors;
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: c.ink, muted: c.muted, line: c.line,
        brand: { DEFAULT: c.brand, deep: c.brandDeep, soft: c.brandSoft },
        sand: c.sand, paper: c.ivory, gold: c.gold,
        now: { DEFAULT: c.now, soft: c.nowSoft }, soon: { DEFAULT: c.soon, soft: c.soonSoft }, ahead: { DEFAULT: c.ahead, soft: c.aheadSoft },
      },
      fontFamily: { body: ["var(--ff-body)", "Arial", "sans-serif"], display: ["var(--ff-body)", "Arial", "sans-serif"], mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"] },
      boxShadow: { card: "0 1px 2px rgb(38 55 70 / .05), 0 10px 24px -18px rgb(38 55 70 / .35)" },
    },
  },
  plugins: [],
} satisfies Config;
