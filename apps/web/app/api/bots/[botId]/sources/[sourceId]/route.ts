import { NextResponse, type NextRequest } from "next/server";
import { requireBotAccess } from "@/lib/auth/bot-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { botId: string; sourceId: string } }
) {
  const guard = await requireBotAccess(params.botId, "admin");
  if (!guard.ok) return guard.response;

  const admin = createSupabaseAdminClient();
  // document_chunks.source_id should cascade on delete at the DB level;
  // deleted explicitly here too so this works even if that FK isn't set up yet.
  await admin.from("document_chunks").delete().eq("source_id", params.sourceId);
  const { error } = await admin.from("knowledge_sources").delete().eq("id", params.sourceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
