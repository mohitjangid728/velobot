import type { ReactNode } from "react";
import { format } from "date-fns";
import { ExternalLink } from "lucide-react";
import type { Organization } from "@velobot/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function RazorpayLink({ kind, id }: { kind: "customers" | "subscriptions"; id: string }) {
  return (
    <a
      href={`https://dashboard.razorpay.com/app/${kind}/${id}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-1 font-mono text-xs text-primary hover:underline"
    >
      {id} <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

export function OrgBillingCard({ org }: { org: Organization }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Billing details</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col p-0 px-6">
        <Row label="Billing interval" value={<span className="capitalize">{org.billing_interval}</span>} />
        <Row label="Currency" value={org.currency} />
        <Row
          label="Payment status"
          value={
            org.payment_status === "past_due" ? (
              <Badge variant="serious">Past due</Badge>
            ) : (
              <Badge variant="success">Active</Badge>
            )
          }
        />
        <Row
          label="Current period"
          value={
            org.current_period_start && org.current_period_end
              ? `${format(new Date(org.current_period_start), "MMM d")} – ${format(new Date(org.current_period_end), "MMM d, yyyy")}`
              : "—"
          }
        />
        <Row
          label="Razorpay customer"
          value={org.razorpay_customer_id ? <RazorpayLink kind="customers" id={org.razorpay_customer_id} /> : "—"}
        />
        <Row
          label="Plan subscription"
          value={org.razorpay_subscription_id ? <RazorpayLink kind="subscriptions" id={org.razorpay_subscription_id} /> : "—"}
        />
        <Row
          label="Seat add-on subscription"
          value={org.addon_seats_subscription_id ? <RazorpayLink kind="subscriptions" id={org.addon_seats_subscription_id} /> : "—"}
        />
      </CardContent>
    </Card>
  );
}
