import { PricingTable } from "@/components/billing/pricing-table";
import { ADDONS, type Currency } from "@velobot/shared";
import { getPlanPriceOverrides } from "@/lib/billing/plan-pricing";

export async function PricingSection({ currency, id }: { currency: Currency; id?: string }) {
  const priceOverrides = await getPlanPriceOverrides();
  return (
    <section id={id} className="mx-auto flex max-w-6xl flex-col items-center gap-10 px-6 py-24">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          Pricing
        </span>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Simple, transparent pricing</h2>
        <p className="max-w-xl text-muted-foreground">
          Start free, upgrade as you grow. Every plan includes the embeddable widget, human handoff, and the Bot
          Actions Engine.
        </p>
      </div>

      <div className="w-full">
        <PricingTable defaultCurrency={currency} mode="link" priceOverrides={priceOverrides} />
      </div>

      <div className="w-full max-w-2xl rounded-xl border bg-card p-6 text-center">
        <h3 className="text-lg font-semibold">Need more capacity?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Add extra messages ({currency === "INR" ? "₹" : "$"}
          {ADDONS.messages.price[currency]} per {ADDONS.messages.amount.toLocaleString()}) or extra seats (
          {currency === "INR" ? "₹" : "$"}
          {ADDONS.seat.price[currency]}/mo each) to any paid plan, any time, from your billing settings.
        </p>
      </div>
    </section>
  );
}
