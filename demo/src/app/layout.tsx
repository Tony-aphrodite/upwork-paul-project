import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { BRAND } from "@/lib/brand";

/** Poppins, the brand typeface: Regular for text, Medium for short labels, SemiBold for headings (and anything bold). */
const poppins = localFont({
  src: [
    { path: "../doc/fonts/poppins-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../doc/fonts/poppins-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "../doc/fonts/poppins-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../doc/fonts/poppins-latin-600-normal.woff2", weight: "600 700", style: "normal" },
  ],
  variable: "--ff-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Ageing Navigator", template: "%s · Ageing Navigator" },
  description: "A free, personalised Family Ageing Action Plan for families in New Zealand.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: BRAND.colors.brand };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NZ" className={poppins.variable}>
      <body>{children}</body>
    </html>
  );
}
