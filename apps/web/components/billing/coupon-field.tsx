"use client";

import { useState } from "react";
import { Ticket, Loader2, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Currency } from "@velobot/shared";

type PurchaseKind = "messages_addon" | "plan_subscription";

/**
 * Validates a coupon code against /api/billing/validate-coupon before the
 * caller ever commits to a specific plan/add-on tier — so an invalid code
 * shows its error right here, inline, instead of only surfacing after
 * checkout has already been kicked off and the plan/add-on picker dialog
 * behind it has already closed (that used to be the only way an invalid
 * coupon error could show, which meant dismissing it lost the whole
 * in-progress purchase). `onApplied`/`onCleared` let the parent carry the
 * validated code (or its absence) into the actual checkout request.
 */
export function CouponField({
  purchaseKind,
  currency,
  onApplied,
  onCleared,
}: {
  purchaseKind: PurchaseKind;
  currency: Currency;
  onApplied: (code: string) => void;
  onCleared: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [code, setCode] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setChecking(true);
    setError(null);
    const res = await fetch("/api/billing/validate-coupon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim(), purchaseKind, currency }),
    });
    const body = await res.json().catch(() => ({}));
    setChecking(false);
    if (!res.ok) {
      setError(body.error ?? "This coupon code isn't valid");
      return;
    }
    setAppliedCode(code.trim().toUpperCase());
    onApplied(code.trim().toUpperCase());
  }

  function clear() {
    setAppliedCode(null);
    setCode("");
    setError(null);
    setExpanded(false);
    onCleared();
  }

  if (appliedCode) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-status-good/30 bg-status-good-bg px-3.5 py-2.5 text-sm">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-status-good" />
        <span className="flex-1 text-status-good">
          Coupon <span className="font-mono font-semibold">{appliedCode}</span> applied
        </span>
        <button
          type="button"
          onClick={clear}
          aria-label="Remove coupon"
          className="rounded-full p-0.5 text-status-good/70 hover:bg-status-good/10 hover:text-status-good"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <Ticket className="h-3.5 w-3.5" /> Have a coupon code?
      </button>
    );
  }

  return (
    <form onSubmit={apply} className="flex w-full max-w-sm flex-col gap-1.5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Ticket className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Coupon code"
            className="pl-9 font-mono uppercase tracking-wide"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError(null);
            }}
            autoFocus
          />
        </div>
        <Button type="submit" variant="outline" disabled={checking || !code.trim()}>
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
        </Button>
      </div>
      {error && <p className="text-xs text-status-critical">{error}</p>}
    </form>
  );
}
