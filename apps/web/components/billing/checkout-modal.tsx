"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics/posthog";
import type { CheckoutSessionInput } from "@velobot/shared";

const KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

interface RazorpayCheckoutOptions {
  key: string;
  order_id?: string;
  name: string;
  description: string;
  handler: (response: Record<string, string>) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
}
interface RazorpayCheckoutInstance {
  open: () => void;
}
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

/**
 * Razorpay Checkout is a self-contained popup, not an embeddable iframe
 * like Stripe's. Any coupon code is applied earlier, on the plan/add-on
 * picker (see billing-panel.tsx / addon-modal.tsx) — Razorpay's own
 * checkout has no field for an arbitrary promo code, since it changes the
 * actual order amount rather than being something Razorpay itself
 * discounts. So `request` arrives here already final: this component's
 * only job is to create the order and open Razorpay's popup, with its own
 * <Dialog> covering just the brief "preparing checkout" / error states in
 * between — never shown at the same time as Razorpay's own modal.
 */
export function CheckoutModal({
  open,
  onOpenChange,
  title,
  request,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  request: CheckoutSessionInput | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [freeActivationDone, setFreeActivationDone] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(() => typeof window !== "undefined" && !!window.Razorpay);
  const startedForRequest = useRef<CheckoutSessionInput | null>(null);

  useEffect(() => {
    // Two CheckoutModal instances can exist at once (the always-mounted
    // "Upgrade plan" one in BillingPanel, and one nested inside AddonModal
    // that only mounts on open) — next/script dedupes by src and only
    // fires onLoad for whichever instance actually triggered the load, so
    // a later instance's own onLoad may never fire even though the script
    // is already sitting on window. Poll for it instead of trusting onLoad
    // alone.
    if (scriptLoaded) return;
    const id = setInterval(() => {
      if (window.Razorpay) {
        setScriptLoaded(true);
        clearInterval(id);
      }
    }, 100);
    return () => clearInterval(id);
  }, [scriptLoaded]);

  async function startCheckout(current: CheckoutSessionInput) {
    setError(null);

    const res = await fetch("/api/razorpay/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(current),
    });
    const resBody = await res.json();
    if (!res.ok) {
      setError(resBody.error ?? "Could not start checkout");
      return;
    }
    // A coupon covered the entire amount — nothing for Razorpay to charge,
    // so the server already activated it directly (see activateFreeOfCharge
    // in checkout/route.ts). No popup to open here.
    if (resBody.freeActivation) {
      trackEvent("checkout_completed", { kind: current.kind });
      setFreeActivationDone(true);
      router.refresh();
      setTimeout(() => onOpenChange(false), 1500);
      return;
    }
    if (!window.Razorpay) {
      setError("Payments script failed to load. Please try again.");
      return;
    }

    const razorpay = new window.Razorpay({
      key: resBody.keyId,
      order_id: resBody.orderId,
      name: "VeloBot - Techfen",
      description: title,
      theme: { color: "#4F46E5" },
      handler: async (response) => {
        await fetch("/api/razorpay/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(response),
        });
        trackEvent("checkout_completed", { kind: current.kind });
        onOpenChange(false);
        router.refresh();
      },
      modal: {
        ondismiss: () => {
          onOpenChange(false);
        },
      },
    });
    // Our own dialog only ever showed the loading/error states — close it
    // now so Razorpay's modal is the only one visible.
    onOpenChange(false);
    razorpay.open();
  }

  useEffect(() => {
    if (!open || !request || !scriptLoaded) return;
    if (startedForRequest.current === request) return;
    startedForRequest.current = request;
    void startCheckout(request);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, request, scriptLoaded]);

  useEffect(() => {
    if (!open) {
      setError(null);
      setFreeActivationDone(false);
      startedForRequest.current = null;
    }
  }, [open]);

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" onLoad={() => setScriptLoaded(true)} />
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {!KEY_ID ? (
              <div className="py-8 text-center text-sm">
                <p className="font-medium text-status-critical">Checkout isn&apos;t configured yet.</p>
                <p className="mt-1 text-muted-foreground">
                  Set <code className="rounded bg-muted px-1 py-0.5 text-xs">NEXT_PUBLIC_RAZORPAY_KEY_ID</code> in{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.example</code> to enable billing.
                </p>
              </div>
            ) : freeActivationDone ? (
              <p className="py-8 text-center text-sm text-status-good">
                Your coupon covered the full amount — no payment needed. You&apos;re all set!
              </p>
            ) : error ? (
              <p className="py-8 text-center text-sm text-status-critical">{error}</p>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Preparing checkout...</p>
            )}
          </DialogBody>
          {KEY_ID && error && request && (
            <DialogFooter>
              <Button
                onClick={() => {
                  startedForRequest.current = null;
                  void startCheckout(request);
                }}
                className="w-full"
              >
                Try again
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
