import { NextResponse, type NextRequest } from "next/server";
import { CreateApiKeySchema, ROLE_RANK } from "@velobot/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getRoleForOrg } from "@/lib/auth/session";
import { assertHasCapability } from "@/lib/billing/guards";
import { generateApiKey, hashApiKey } from "@/lib/auth/api-key";

export async function GET(_req: NextRequest, { params }: { params: { orgId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getRoleForOrg(user.id, params.orgId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createSupabaseAdminClient();
  // Never select key_hash — this response is the list view, the secret is
  // never recoverable/re-displayable after creation.
  const { data: keys } = await admin
    .from("api_keys")
    .select("id, name, key_prefix, last_used_at, revoked_at, created_at")
    .eq("org_id", params.orgId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ keys: keys ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: { orgId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getRoleForOrg(user.id, params.orgId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const capability = await assertHasCapability(params.orgId, "apiAccess");
  if (!capability.allowed) return NextResponse.json({ error: capability.reason }, { status: 402 });

  const parsed = CreateApiKeySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { secret, prefix } = generateApiKey();
  const admin = createSupabaseAdminClient();
  const { data: key, error } = await admin
    .from("api_keys")
    .insert({ org_id: params.orgId, name: parsed.data.name, key_prefix: prefix, key_hash: hashApiKey(secret), created_by: user.id })
    .select("id, name, key_prefix, last_used_at, revoked_at, created_at")
    .single();
  if (error || !key) return NextResponse.json({ error: error?.message ?? "Failed to create key" }, { status: 500 });

  // The only response that ever carries the full secret — shown to the
  // admin exactly once, matching the pattern the UI's copy-to-clipboard
  // dialog expects.
  return NextResponse.json({ key: { ...key, secret } });
}
