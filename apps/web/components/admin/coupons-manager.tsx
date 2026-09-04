"use client";

import { useState } from "react";
import { Plus, Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Coupon, CouponAppliesTo, CouponDiscountType, Currency } from "@velobot/shared";

const APPLIES_TO_LABEL: Record<CouponAppliesTo, string> = {
  messages_addon: "Messages add-on",
  plan_subscription: "Plan / seat subscription",
  all: "All purchases",
};

export function CouponsManager({ initialCoupons, canManage }: { initialCoupons: Coupon[]; canManage: boolean }) {
  const [coupons, setCoupons] = useState(initialCoupons);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<CouponDiscountType>("percent");
  const [discountValue, setDiscountValue] = useState("10");
  const [appliesTo, setAppliesTo] = useState<CouponAppliesTo>("messages_addon");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        discount_type: discountType,
        discount_value: Number(discountValue),
        applies_to: appliesTo,
        currency: discountType === "fixed" ? currency : undefined,
        max_redemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setCreating(false);
    if (!res.ok) {
      setError(typeof body.error === "string" ? body.error : "Failed to create coupon");
      return;
    }
    setCoupons((prev) => [body.coupon, ...prev]);
    setDialogOpen(false);
    setCode("");
    setDiscountValue("10");
    setMaxRedemptions("");
    setExpiresAt("");
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this coupon? It can no longer be applied to new purchases.")) return;
    setCoupons((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: false } : c)));
    await fetch(`/api/admin/coupons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: false }),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {canManage && (
        <Button onClick={() => setDialogOpen(true)} className="w-fit">
          <Plus className="mr-1 h-4 w-4" /> Create coupon
        </Button>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All coupons</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y p-0">
          {coupons.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 text-sm">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium">{c.code}</span>
                  <Badge variant={c.is_active ? "default" : "outline"}>{c.is_active ? "Active" : "Revoked"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.discount_type === "percent" ? `${c.discount_value}% off` : `${c.currency ?? ""} ${c.discount_value} off`} ·{" "}
                  {APPLIES_TO_LABEL[c.applies_to]} · {c.times_redeemed}
                  {c.max_redemptions ? `/${c.max_redemptions}` : ""} redeemed
                  {c.expires_at && ` · expires ${new Date(c.expires_at).toLocaleDateString()}`}
                </p>
              </div>
              {canManage && c.is_active && (
                <button onClick={() => revoke(c.id)} aria-label="Revoke" className="text-muted-foreground hover:text-destructive">
                  <Ban className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {coupons.length === 0 && <p className="px-6 py-4 text-sm text-muted-foreground">No coupons yet.</p>}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create coupon</DialogTitle>
          </DialogHeader>
          <form onSubmit={create}>
            <DialogBody className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="coupon-code">Code</Label>
                <Input
                  id="coupon-code"
                  required
                  placeholder="LAUNCH20"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label>Discount type</Label>
                  <Select value={discountType} onValueChange={(v) => setDiscountType(v as CouponDiscountType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percent off</SelectItem>
                      <SelectItem value="fixed">Fixed amount off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="coupon-value">{discountType === "percent" ? "Percent" : "Amount"}</Label>
                  <Input
                    id="coupon-value"
                    type="number"
                    min={0}
                    max={discountType === "percent" ? 100 : undefined}
                    required
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                  />
                </div>
                {discountType === "fixed" && (
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Label>Currency</Label>
                    <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="INR">INR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {discountType === "fixed" && (
                <p className="-mt-2 text-xs text-muted-foreground">
                  A fixed amount only applies to purchases in this currency — &quot;$10 off&quot; isn&apos;t &quot;₹10
                  off&quot;.
                </p>
              )}
              <div className="flex flex-col gap-1.5">
                <Label>Applies to</Label>
                <Select value={appliesTo} onValueChange={(v) => setAppliesTo(v as CouponAppliesTo)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="messages_addon">Messages add-on</SelectItem>
                    <SelectItem value="plan_subscription">Plan / seat subscription</SelectItem>
                    <SelectItem value="all">All purchases</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="coupon-max">Max redemptions (optional)</Label>
                  <Input id="coupon-max" type="number" min={1} value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="coupon-expires">Expires (optional)</Label>
                  <Input id="coupon-expires" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </DialogBody>
            <DialogFooter>
              <Button type="submit" disabled={creating} className="w-full">
                {creating ? "Creating..." : "Create coupon"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
