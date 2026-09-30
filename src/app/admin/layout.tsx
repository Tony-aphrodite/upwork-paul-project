import { redirect } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { currentNavigator } from "@/lib/session";
import { content } from "@/lib/pilot/library";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const nav = await currentNavigator();
  if (!nav) redirect("/login");
  return <AdminShell name={nav.name} draft={content.status === "draft"}>{children}</AdminShell>;
}
