import { NextResponse, type NextRequest } from "next/server";
import { UpdateBotSchema } from "@velobot/shared";
import { requireBotAccess } from "@/lib/auth/bot-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: NextRequest, { params }: { params: { botId: string } }) {
  const guard = await requireBotAccess(params.botId, "admin");
  if (!guard.ok) return guard.response;

  const parsed = UpdateBotSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: bot, error } = await admin
    .from("bots")
    .update(parsed.data)
    .eq("id", params.botId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bot });
}

export async function DELETE(_req: NextRequest, { params }: { params: { botId: string } }) {
  const guard = await requireBotAccess(params.botId, "admin");
  if (!guard.ok) return guard.response;

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("bots").delete().eq("id", params.botId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
