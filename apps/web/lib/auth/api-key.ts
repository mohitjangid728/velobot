import "server-only";
import { randomBytes, createHash } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const KEY_PREFIX_LEN = 8;

export function hashApiKey(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** `secret` is shown to the admin exactly once at creation time; only `prefix` is ever displayed again. */
export function generateApiKey(): { secret: string; prefix: string } {
  const raw = randomBytes(24).toString("hex");
  const prefix = raw.slice(0, KEY_PREFIX_LEN);
  return { secret: `vb_live_${raw}`, prefix };
}

export interface ApiKeyAuth {
  orgId: string;
  apiKeyId: string;
}

/**
 * Auth choke point for every app/api/v1/* route — mirrors the role/session
 * choke point getRoleForOrg() plays for the dashboard/inbox, but resolves
 * from an `Authorization: Bearer <key>` header instead of a cookie session,
 * since a developer-API caller has no browser session at all.
 */
export async function requireApiKey(req: NextRequest): Promise<ApiKeyAuth | NextResponse> {
  const header = req.headers.get("authorization") ?? "";
  const secret = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
  if (!secret) {
    return NextResponse.json({ error: "Missing Authorization: Bearer <key> header" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: key } = await admin
    .from("api_keys")
    .select("id, org_id, revoked_at")
    .eq("key_hash", hashApiKey(secret))
    .maybeSingle();

  if (!key || key.revoked_at) {
    return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 });
  }

  // Fire-and-forget — a slow/failed write here must never block or fail the
  // actual API request the key was presented for.
  void admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);

  return { orgId: key.org_id, apiKeyId: key.id };
}
