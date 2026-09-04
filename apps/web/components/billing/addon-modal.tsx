"use client";

import { useState } from "react";
import { ADDONS, type Currency } from "@velobot/shared";
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [showCouponField, setShowCouponField] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const def = ADDONS[addon];
  const total = def.price[currency] * quantity;

  const label = addon === "messages" ? "extra 1,000 messages" : "extra agent seat";

  return (
    <>
      <Dialog open={open && !checkoutOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Buy {label}</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {CURRENCY_SYMBOL[currency]}
              {def.price[currency]} {addon === "seat" ? "per seat, per month" : "per pack, one-time"}.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="addon-quantity">Quantity</Label>
              <Input
                id="addon-quantity"
                type="number"
                min={1}
                max={20}
                value={quantity}
                onChange={(e) => setQuantity(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
              />
            </div>
            <p className="text-sm font-medium">
              Total: {CURRENCY_SYMBOL[currency]}
              {total.toLocaleString()}
              {addon === "seat" ? "/mo" : ""}
            </p>
            {showCouponField ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="addon-coupon-code">Coupon code</Label>
                <Input
                  id="addon-coupon-code"
                  placeholder="e.g. LAUNCH20"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  autoFocus
                />
              </div>
            ) : (
              <button
                type="button"
                className="self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                onClick={() => setShowCouponField(true)}
              >
                Have a coupon code?
              </button>
            )}
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
        onOpenChange={(next) => {
          setCheckoutOpen(next);
          if (!next) onOpenChange(false);
        }}
        title={`Buy ${label}`}
        request={{ kind: "addon", addon, currency, quantity, ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}) }}
      />
    </>
  );
}
