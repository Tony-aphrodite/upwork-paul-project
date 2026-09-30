import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const body = localFont({ src: [{ path: "../doc/fonts/atkinson-hyperlegible-latin-400-normal.woff2", weight: "400" }, { path: "../doc/fonts/atkinson-hyperlegible-latin-700-normal.woff2", weight: "700" }], variable: "--ff-body", display: "swap" });
const display = localFont({ src: "../doc/fonts/literata-latin-wght-normal.woff2", weight: "300 800", variable: "--ff-display", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Ageing Navigator", template: "%s · Ageing Navigator" },
  description: "A free, personalised Family Ageing Action Plan for families in New Zealand.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#1F4E5F" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NZ" className={`${body.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
