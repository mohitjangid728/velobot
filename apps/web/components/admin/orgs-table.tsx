"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { getEffectivePlan, type Organization, type PlanOverrideMap } from "@velobot/shared";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { UsageSummary } from "@/lib/billing/usage";

export type OrgRow = Organization & { usage: UsageSummary };

export function OrgsTable({ orgs, canManage, planOverrides }: { orgs: OrgRow[]; canManage: boolean; planOverrides?: PlanOverrideMap }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter(
      (org) => org.name.toLowerCase().includes(q) || org.slug.toLowerCase().includes(q) || org.plan.toLowerCase().includes(q)
    );
  }, [orgs, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((o) => o.id))));
  }

  async function applyBulk(suspended: boolean) {
    setApplying(true);
    await Promise.all(
      [...selected].map((id) =>
        fetch(`/api/admin/orgs/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suspended }),
        })
      )
    );
    setApplying(false);
    setSelected(new Set());
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, slug, or plan..."
            className="pl-9"
          />
        </div>
        {canManage && selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-sm">
            <span className="text-muted-foreground">{selected.size} selected</span>
            <Button size="sm" variant="outline" disabled={applying} onClick={() => applyBulk(false)}>
              Reactivate
            </Button>
            <Button size="sm" variant="destructive" disabled={applying} onClick={() => applyBulk(true)}>
              Suspend
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              {canManage && (
                <th className="w-8 px-4 py-2">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
              )}
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Plan</th>
              <th className="px-4 py-2">Members</th>
              <th className="px-4 py-2">Bots</th>
              <th className="px-4 py-2">Messages (period)</th>
              <th className="px-4 py-2">Pages</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-card">
            {filtered.map((org) => {
              const plan = getEffectivePlan(org.plan, planOverrides);
              return (
                <tr key={org.id} className="hover:bg-muted/40">
                  {canManage && (
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(org.id)}
                        onChange={() => toggle(org.id)}
                        aria-label={`Select ${org.name}`}
                      />
                    </td>
                  )}
                  <td className="px-4 py-2">
                    <Link href={`/admin/orgs/${org.id}`} className="font-medium text-primary hover:underline">
                      {org.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 capitalize">{org.plan}</td>
                  <td className="px-4 py-2">
                    {org.usage.seats}/{org.seats_limit}
                  </td>
                  <td className="px-4 py-2">
                    {org.usage.bots}/{plan.quota.bots}
                  </td>
                  <td className="px-4 py-2">
                    {org.usage.messagesThisPeriod.toLocaleString()}/{(plan.quota.messagesPerMonth + org.addon_message_balance).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    {org.usage.pages}/{plan.quota.pages}
                  </td>
                  <td className="px-4 py-2">
                    {org.suspended_at ? <Badge variant="destructive">Suspended</Badge> : <Badge variant="success">Active</Badge>}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{format(new Date(org.created_at), "PP")}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={canManage ? 9 : 8} className="px-4 py-8 text-center text-muted-foreground">
                  No organizations match &ldquo;{query}&rdquo;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
