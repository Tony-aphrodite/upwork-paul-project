import { redirect } from "next/navigation";

/**
 * The client's website (ageingnavigator.com) is the front door: its buttons link to /start. This address only forwards
 * there, keeping any ?ref=, ?reason= or ?for= the link carried.
 */
export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string" && ["ref", "reason", "for"].includes(k)) params.set(k, v);
  const qs = params.toString();
  redirect(qs ? `/start?${qs}` : "/start");
}
