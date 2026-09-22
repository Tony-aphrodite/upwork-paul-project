import { NextResponse } from "next/server";
import { builtInLibrary } from "@/lib/library";

export async function GET() {
  return NextResponse.json(builtInLibrary);
}
