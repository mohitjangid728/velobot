import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireApiAccess } from "@/lib/auth/require-api-access";

const MAX_LIMIT = 100;

/**
 * GET /api/v1/conversations — paginated list, scoped to the calling org via
 * the API key (never trusts an org_id from the query string). See
 * docs/API.md "Public API (v1)".
 * Query params: bot_id (optional filter), status (optional filter),
 * limit (default 25, max 100), offset (default 0).
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiAccess(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const botId = url.searchParams.get("bot_id");
  const status = url.searchParams.get("status");
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get("limit")) || 25));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("conversations")
    .select("id, bot_id, visitor_email, status, last_message_at, created_at", { count: "exact" })
    .eq("org_id", auth.orgId)
    .order("last_message_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (botId) query = query.eq("bot_id", botId);
  if (status) query = query.eq("status", status);

  const { data, count } = await query;

  return NextResponse.json({ data: data ?? [], pagination: { limit, offset, total: count ?? 0 } });
}
