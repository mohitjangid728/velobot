import { NextResponse, type NextRequest } from "next/server";
import { requirePlatformAdminApi } from "@/lib/auth/platform-admin";
import { searchPlatform } from "@/lib/admin/search";

export async function GET(req: NextRequest) {
  const admin = await requirePlatformAdminApi();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const results = await searchPlatform(req.nextUrl.searchParams.get("q") ?? "");
  return NextResponse.json(results);
}
