import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireApiAccess } from "@/lib/auth/require-api-access";

/** GET /api/v1/bots — list the calling org's bots. See docs/API.md "Public API (v1)". */
export async function GET(req: NextRequest) {
  const auth = await requireApiAccess(req);
  if (auth instanceof NextResponse) return auth;

  const admin = createSupabaseAdminClient();
  const { data: bots } = await admin
    .from("bots")
    .select("id, name, description, created_at")
    .eq("org_id", auth.orgId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ data: bots ?? [] });
}
