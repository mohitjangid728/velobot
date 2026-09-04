"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";

/**
 * plan/interval/currency come from the pricing page's "Get started" link
 * (via signup's query string) — the org itself is always created on the
 * free tier here (org.plan only ever changes once Razorpay confirms
 * payment), but a paid selection is carried into the billing page's URL so
 * it can auto-open Checkout there instead of silently landing on Free.
 */
export function OnboardingForm({ plan, interval, currency }: { plan?: string; interval?: string; currency?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not create workspace.");
      return;
    }
    const destination =
      plan && plan !== "free"
        ? `/dashboard/settings/billing?plan=${plan}&interval=${interval ?? "monthly"}&currency=${currency ?? "USD"}`
        : "/dashboard";
    router.push(destination);
    router.refresh();
  }

  return (
    <AuthShell title="Create your workspace" description="You'll be its Admin — you can invite teammates after.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Workspace name</Label>
          <Input id="name" required minLength={2} placeholder="Acme Inc." value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loading} size="lg" className="mt-1">
          {loading ? "Creating..." : "Create workspace"}
        </Button>
      </form>
    </AuthShell>
  );
}
