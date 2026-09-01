import "server-only";
import { NextResponse } from "next/server";
import { ROLE_RANK, type Bot, type Role } from "@velobot/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getRoleForOrg } from "@/lib/auth/session";

type BotGuardResult =
  | { ok: true; bot: Bot; role: Role; userId: string }
  | { ok: false; response: NextResponse };

/** Verifies the current user belongs to the bot's org with at least `minRole`. Every bot-scoped Route Handler uses this. */
export async function requireBotAccess(botId: string, minRole: Role): Promise<BotGuardResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = createSupabaseAdminClient();
  const { data: bot } = await admin.from("bots").select("*").eq("id", botId).maybeSingle();
  if (!bot) {
    return { ok: false, response: NextResponse.json({ error: "Bot not found" }, { status: 404 }) };
  }

  const role = await getRoleForOrg(user.id, bot.org_id);
  if (!role || ROLE_RANK[role] < ROLE_RANK[minRole]) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true, bot: bot as Bot, role, userId: user.id };
}
