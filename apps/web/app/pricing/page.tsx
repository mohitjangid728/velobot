import { headers } from "next/headers";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PricingSection } from "@/components/marketing/pricing-section";
import { detectCurrency } from "@/lib/billing/currency";

export default function PricingPage() {
  const currency = detectCurrency(headers());

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <PricingSection currency={currency} />
      </main>
      <SiteFooter />
    </div>
  );
}
