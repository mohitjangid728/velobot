import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getRoleForOrg } from "@/lib/auth/session";

const HeartbeatSchema = z.object({
  org_id: z.string().uuid(),
  status: z.enum(["online", "away", "offline"]),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = HeartbeatSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const role = await getRoleForOrg(user.id, parsed.data.org_id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("agent_presence").upsert(
    {
      user_id: user.id,
      org_id: parsed.data.org_id,
      status: parsed.data.status,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,org_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
