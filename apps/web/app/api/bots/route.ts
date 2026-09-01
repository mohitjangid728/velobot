import { NextResponse, type NextRequest } from "next/server";
import { CreateBotSchema, ROLE_RANK } from "@velobot/shared";
import { getActiveOrg } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertCanCreateBot } from "@/lib/billing/guards";

export async function POST(req: NextRequest) {
  const { org, role } = await getActiveOrg();
  if (!org || !role) return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  if (ROLE_RANK[role] < ROLE_RANK.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = CreateBotSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const guard = await assertCanCreateBot(org.id);
  if (!guard.allowed) return NextResponse.json({ error: guard.reason }, { status: 402 });

  const admin = createSupabaseAdminClient();
  const { data: bot, error } = await admin
    .from("bots")
    .insert({
      org_id: org.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      welcome_message: parsed.data.welcome_message,
      theme_color: parsed.data.theme_color,
      avatar_url: parsed.data.avatar_url ?? null,
      launcher_icon_url: parsed.data.launcher_icon_url ?? null,
      allowed_domains: parsed.data.allowed_domains ?? [],
      system_prompt_extra: parsed.data.system_prompt_extra ?? null,
      fallback_email_enabled: parsed.data.fallback_email_enabled ?? true,
      queue_id: parsed.data.queue_id ?? null,
    })
    .select()
    .single();

  if (error || !bot) return NextResponse.json({ error: error?.message ?? "Failed to create bot" }, { status: 500 });
  return NextResponse.json({ bot });
}
