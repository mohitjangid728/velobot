import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { requireApiKey, type ApiKeyAuth } from "@/lib/auth/api-key";
import { assertHasCapability } from "@/lib/billing/guards";
import { checkApiRateLimit } from "@/lib/security/rate-limit-api";

/**
 * Combines the three checks every app/api/v1/* route needs, in order: valid
 * key → org's plan actually has apiAccess (a key from a downgraded org
 * should stop working, not just stop being issuable) → per-key rate limit.
 * Routes call this once and either get back the auth context or forward the
 * NextResponse it already built.
 */
export async function requireApiAccess(req: NextRequest): Promise<ApiKeyAuth | NextResponse> {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const capability = await assertHasCapability(auth.orgId, "apiAccess");
  if (!capability.allowed) return NextResponse.json({ error: capability.reason }, { status: 402 });

  const rateLimit = await checkApiRateLimit(auth.apiKeyId);
  if (!rateLimit.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  return auth;
}
