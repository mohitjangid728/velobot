"use client";

import { useState } from "react";
import { Minus, Plus, MessageSquarePlus, UserPlus } from "lucide-react";
import { ADDONS, type Currency } from "@velobot/shared";
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CouponField } from "@/components/billing/coupon-field";
import { CheckoutModal } from "./checkout-modal";

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", INR: "₹" };

export function AddonModal({
  open,
  onOpenChange,
  addon,
  currency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addon: "messages" | "seat";
  currency: Currency;
}) {
  const [quantity, setQuantity] = useState(1);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const def = ADDONS[addon];
  const total = def.price[currency] * quantity;
  const Icon = addon === "messages" ? MessageSquarePlus : UserPlus;

  const label = addon === "messages" ? "extra 1,000 messages" : "extra agent seat";

  return (
    <>
      <Dialog open={open && !checkoutOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>Buy {label}</DialogTitle>
            <DialogDescription>
              {CURRENCY_SYMBOL[currency]}
              {def.price[currency]} {addon === "seat" ? "per seat, per month" : "per pack, one-time"}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-5">
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <span className="text-sm font-medium">Quantity</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-semibold tabular-nums">{quantity}</span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  disabled={quantity >= 20}
                  onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-lg font-bold">
                {CURRENCY_SYMBOL[currency]}
                {total.toLocaleString()}
                {addon === "seat" && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
              </span>
            </div>

            <CouponField
              purchaseKind={addon === "messages" ? "messages_addon" : "plan_subscription"}
              currency={currency}
              onApplied={setAppliedCoupon}
              onCleared={() => setAppliedCoupon(null)}
            />
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setCheckoutOpen(true)} className="w-full">
              Continue to checkout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CheckoutModal
        open={checkoutOpen}
        // Dismissing Checkout (e.g. after a payment error) returns to this
        // modal's own picker rather than closing the whole flow — the
        // coupon was already validated before getting here, but a genuine
        // Razorpay-side failure shouldn't cost the user their quantity/
        // coupon selection too.
        onOpenChange={setCheckoutOpen}
        title={`Buy ${label}`}
        request={{ kind: "addon", addon, currency, quantity, ...(appliedCoupon ? { couponCode: appliedCoupon } : {}) }}
      />
    </>
  );
}
