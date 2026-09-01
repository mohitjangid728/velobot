import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireApiAccess } from "@/lib/auth/require-api-access";

/** GET /api/v1/conversations/:id — one conversation + its full message history, org-scoped via the API key. See docs/API.md "Public API (v1)". */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiAccess(req);
  if (auth instanceof NextResponse) return auth;

  const admin = createSupabaseAdminClient();
  const { data: conversation } = await admin
    .from("conversations")
    .select("id, bot_id, visitor_email, visitor_url, status, last_message_at, created_at")
    .eq("id", params.id)
    .eq("org_id", auth.orgId)
    .maybeSingle();

  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const { data: messages } = await admin
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ data: { ...conversation, messages: messages ?? [] } });
}
