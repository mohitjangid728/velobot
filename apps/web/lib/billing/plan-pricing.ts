import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { priceOverrideKey, type PlanPriceOverrideMap, type PlanPriceOverride } from "@velobot/shared";

/** All Super-Admin-edited prices, as the `${tier}:${interval}:${currency}` -> amount map getEffectivePrice() expects. Every pricing display (public /pricing page, dashboard billing settings, admin MRR calc) should call this once and pass the result down, rather than reading plan_price_overrides directly. */
export async function getPlanPriceOverrides(): Promise<PlanPriceOverrideMap> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("plan_price_overrides").select("tier, interval, currency, amount");
  const map: PlanPriceOverrideMap = {};
  for (const row of (data ?? []) as Pick<PlanPriceOverride, "tier" | "interval" | "currency" | "amount">[]) {
    map[priceOverrideKey(row.tier, row.interval, row.currency)] = row.amount;
  }
  return map;
}

export async function listPlanPriceOverrides(): Promise<PlanPriceOverride[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("plan_price_overrides").select("*").order("tier").order("interval").order("currency");
  return (data ?? []) as PlanPriceOverride[];
}

export async function upsertPlanPriceOverride(input: {
  tier: PlanPriceOverride["tier"];
  interval: PlanPriceOverride["interval"];
  currency: PlanPriceOverride["currency"];
  amount: number;
  updatedBy: string;
}): Promise<PlanPriceOverride> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("plan_price_overrides")
    .upsert(
      {
        tier: input.tier,
        interval: input.interval,
        currency: input.currency,
        amount: input.amount,
        updated_by: input.updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tier,interval,currency" }
    )
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to save price override");
  return data as PlanPriceOverride;
}
