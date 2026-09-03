import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PlanOverride, PlanTier } from "@velobot/shared";
import type { PlanOverrideMap, PlanOverrideFields } from "@velobot/shared";
import type { UpdatePlanDetailsInput } from "@velobot/shared";

function toFields(row: PlanOverride): PlanOverrideFields {
  const quota: PlanOverrideFields["quota"] = {};
  if (row.quota_bots !== null) quota.bots = row.quota_bots;
  if (row.quota_pages !== null) quota.pages = row.quota_pages;
  if (row.quota_messages_per_month !== null) quota.messagesPerMonth = row.quota_messages_per_month;
  if (row.quota_agent_seats !== null) quota.agentSeats = row.quota_agent_seats;

  const capabilities: PlanOverrideFields["capabilities"] = {};
  if (row.capability_remove_branding !== null) capabilities.removeBranding = row.capability_remove_branding;
  if (row.capability_api_access !== null) capabilities.apiAccess = row.capability_api_access;

  return {
    quota,
    capabilities,
    features: row.features ?? undefined,
    badgeText: row.badge_text,
  };
}

/** All tiers' overrides, keyed by tier — for pages that display multiple plans side by side (pricing table, admin org lists). */
export async function getPlanOverrides(): Promise<PlanOverrideMap> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("plan_overrides").select("*");
  const map: PlanOverrideMap = {};
  for (const row of (data ?? []) as PlanOverride[]) map[row.tier] = toFields(row);
  return map;
}

/** One tier's override, in the same PlanOverrideMap shape getEffectivePlan() expects — for hot-path call sites (guards.ts) that only ever need their own org's tier, so they don't pay for fetching all four. */
export async function getPlanOverride(tier: PlanTier): Promise<PlanOverrideMap> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("plan_overrides").select("*").eq("tier", tier).maybeSingle();
  if (!data) return {};
  return { [tier]: toFields(data as PlanOverride) };
}

/** Raw rows (nulls intact) for the admin editor to prefill exact current values — toFields() above collapses null into "absent," which loses the distinction between "explicitly cleared" and "never set" that an editor form needs. */
export async function listPlanOverridesRaw(): Promise<PlanOverride[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("plan_overrides").select("*").order("tier");
  return (data ?? []) as PlanOverride[];
}

/** Only touches the columns present in `input` (Zod's .optional() on every field) — Supabase's upsert's ON CONFLICT UPDATE SET only lists the payload's own keys, so omitted fields keep their existing value rather than getting reset to null. */
export async function upsertPlanOverride(input: UpdatePlanDetailsInput, updatedBy: string): Promise<PlanOverride> {
  const admin = createSupabaseAdminClient();
  const { tier, ...fields } = input;
  const { data, error } = await admin
    .from("plan_overrides")
    .upsert({ tier, ...fields, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: "tier" })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to save plan details");
  return data as PlanOverride;
}
