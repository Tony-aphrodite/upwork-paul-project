/**
 * Brand settings in one place, from Ageing Navigator's Brand Guide v1 (2 October 2026, `client-files/brand/`):
 * deep teal for identity and headings, slate for body text, soft ivory backgrounds, warm gold for occasional
 * accents only (it is too light for small text), Poppins. The web pages (through tailwind.config.ts), the emails and
 * the PDF all read these values.
 *
 * Contact details are only those the client has confirmed: his email address. No phone number has been given.
 */
export const BRAND = {
  name: "Ageing Navigator",
  planTitle: "Family Ageing Action Plan",
  email: "paul@ageingnavigator.com",
  phone: "",
  site: "ageingnavigator.com",
  colors: {
    ink: "#263746", // slate: body text
    muted: "#55636F", // secondary text; 5.7:1 on ivory
    line: "#DDD9CF",
    brand: "#174A4B", // deep teal
    brandDeep: "#0F3536",
    brandSoft: "#E6EFEE",
    gold: "#C6923A", // accents only, never small text
    ivory: "#F7F5EF",
    sand: "#F6EEDF", // gold tint for information boxes
    now: "#A23B2C",
    nowSoft: "#F8E9E6",
    soon: "#8A5A10",
    soonSoft: "#F7EEDC",
    ahead: "#2D6A55",
    aheadSoft: "#E5F1EC",
  },
  font: "Poppins",
};

/** How the family can reach the service, in words, from the confirmed details only. */
export function contactLine() {
  const ways = [BRAND.phone && `call ${BRAND.phone}`, BRAND.email && `email ${BRAND.email}`].filter(Boolean);
  return ways.length ? ways.join(" or ") : `visit ${BRAND.site}`;
}
