import { NextResponse } from "next/server";
import { z } from "zod";
import { ActionPlan, FamilyProfile, ModuleDefinition } from "@/lib/schema";

const SCHEMAS = { "family-profile": FamilyProfile, "action-plan": ActionPlan, "module-definition": ModuleDefinition } as const;

/** JSON Schema for each contract, generated from the same Zod definitions the server validates with. */
export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const schema = SCHEMAS[name as keyof typeof SCHEMAS];
  if (!schema) return NextResponse.json({ error: "Unknown schema", available: Object.keys(SCHEMAS) }, { status: 404 });
  return NextResponse.json(z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }));
}
