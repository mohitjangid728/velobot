"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Receipt, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Organization } from "@velobot/shared";

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  shortUrl: string | null;
  createdAt: string;
}

const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", INR: "₹" };

/**
 * The self-serve replacement for Stripe's hosted Customer Portal —
 * Razorpay has no equivalent, so this lives directly in the dashboard.
 * Cancellation calls the API but never mutates local plan state itself;
 * the subscription.cancelled webhook is what actually flips the org back
 * to free, so this just reflects "cancellation requested" until a refresh
 * picks up the real state.
 */
export function ManageSubscriptionPanel({ org }: { org: Organization }) {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [cancelling, setCancelling] = useState<"plan" | "addon_seat" | null>(null);
  const [requested, setRequested] = useState<"plan" | "addon_seat" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!org.razorpay_subscription_id) return;
    fetch("/api/razorpay/invoices")
      .then((r) => r.json())
      .then((body) => setInvoices(body.invoices ?? []));
  }, [org.razorpay_subscription_id]);

  async function cancel(target: "plan" | "addon_seat") {
    const label = target === "plan" ? "your plan" : "the extra seat add-on";
    if (!confirm(`Cancel ${label}? This takes effect at the end of the current billing period.`)) return;
    setCancelling(target);
    setError(null);
    const res = await fetch("/api/razorpay/cancel-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target }),
    });
    setCancelling(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not cancel");
      return;
    }
    setRequested(target);
  }

  if (org.plan === "free" && !org.razorpay_subscription_id) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Manage subscription</CardTitle>
        <CardDescription>Cancel your plan or seat add-on, and review past payments.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && <p className="text-sm text-status-critical">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {org.razorpay_subscription_id && (
            <Button variant="outline" onClick={() => cancel("plan")} disabled={cancelling === "plan" || requested === "plan"}>
              {requested === "plan" ? "Cancellation scheduled" : cancelling === "plan" ? "Cancelling..." : "Cancel plan"}
            </Button>
          )}
          {org.addon_seats_subscription_id && (
            <Button
              variant="outline"
              onClick={() => cancel("addon_seat")}
              disabled={cancelling === "addon_seat" || requested === "addon_seat"}
            >
              {requested === "addon_seat" ? "Cancellation scheduled" : cancelling === "addon_seat" ? "Cancelling..." : "Cancel seat add-on"}
            </Button>
          )}
        </div>

        {invoices && invoices.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Receipt className="h-3.5 w-3.5" /> Payment history
            </p>
            <div className="flex flex-col divide-y rounded-lg border">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">{format(new Date(inv.createdAt), "MMM d, yyyy")}</span>
                  <span className="font-medium">
                    {CURRENCY_SYMBOL[inv.currency] ?? ""}
                    {(inv.amount / 100).toLocaleString()}
                  </span>
                  <Badge variant={inv.status === "paid" ? "success" : "secondary"} className="capitalize">
                    {inv.status}
                  </Badge>
                  {inv.shortUrl ? (
                    <a href={inv.shortUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
