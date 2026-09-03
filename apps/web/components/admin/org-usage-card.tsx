import { getEffectivePlan, type Organization, type PlanOverrideMap } from "@velobot/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuotaBar } from "@/components/dashboard/billing-panel";
import type { UsageSummary } from "@/lib/billing/usage";

export function OrgUsageCard({
  org,
  usage,
  planOverrides,
}: {
  org: Organization;
  usage: UsageSummary;
  planOverrides?: PlanOverrideMap;
}) {
  const plan = getEffectivePlan(org.plan, planOverrides);
  const messageLimit = plan.quota.messagesPerMonth + org.addon_message_balance;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Usage this period</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <QuotaBar label="Bots" used={usage.bots} limit={plan.quota.bots} />
        <QuotaBar
          label="AI messages"
          used={usage.messagesThisPeriod}
          limit={messageLimit}
          extra={org.addon_message_balance > 0 ? `(+${org.addon_message_balance} add-on)` : undefined}
        />
        <QuotaBar label="Pages indexed" used={usage.pages} limit={plan.quota.pages} />
        <QuotaBar label="Team seats" used={usage.seats} limit={org.seats_limit} />
      </CardContent>
    </Card>
  );
}
