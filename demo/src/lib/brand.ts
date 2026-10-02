/**
 * Brand settings in one place. Placeholders until Ageing Navigator's logo, colours and contact details arrive: then
 * only this file changes, and the web pages, emails and PDF follow. The phone number is the demo placeholder.
 */
export const BRAND = {
  name: "Ageing Navigator",
  planTitle: "Family Ageing Action Plan",
  email: "hello@example.test",
  phone: "0123456789",
  site: "ageingnavigator.com",
  colors: { ink: "#1B2A30", muted: "#4F5F66", line: "#D8DEE0", brand: "#1F4E5F", brandSoft: "#E7EFF1", sand: "#F6F1E8", now: "#A23B2C", nowSoft: "#F8E9E6", soon: "#8A5A10", soonSoft: "#F7EEDC", ahead: "#2D6A55", aheadSoft: "#E5F1EC" },
  logoSvg: (size = 36) => `<svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true"><rect width="40" height="40" rx="10" fill="#1F4E5F"/><path d="M9 30c7 0 6-9 12-9s6-8 10-8" stroke="#F4EBDD" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="31" cy="13" r="3.4" fill="#E0A458"/><circle cx="9" cy="30" r="2.3" fill="#F4EBDD"/></svg>`,
};
