"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackEvent } from "@/lib/analytics/posthog";
import type { CheckoutSessionInput } from "@velobot/shared";

const KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

interface RazorpayCheckoutOptions {
  key: string;
  subscription_id?: string;
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

type Phase = "review" | "processing";

/**
 * Razorpay Checkout is a self-contained popup, not an embeddable iframe
 * like Stripe's — this component's own <Dialog> covers the "review your
 * order / enter a coupon" step and the brief "preparing checkout" / error
 * states between confirming and Razorpay's own modal opening; the two are
 * never shown stacked.
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
  const [phase, setPhase] = useState<Phase>("review");
  const [couponCode, setCouponCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(() => typeof window !== "undefined" && !!window.Razorpay);

  useEffect(() => {
    if (open) {
      setPhase("review");
      setCouponCode("");
      setError(null);
    }
  }, [open]);

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

  async function startCheckout() {
    if (!request) return;
    if (!scriptLoaded) {
      setError("Payments script is still loading. Please try again in a moment.");
      return;
    }
    setPhase("processing");
    setError(null);

    const body: CheckoutSessionInput = couponCode.trim()
      ? ({ ...request, couponCode: couponCode.trim() } as CheckoutSessionInput)
      : request;

    const res = await fetch("/api/razorpay/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const resBody = await res.json();
    if (!res.ok) {
      setError(resBody.error ?? "Could not start checkout");
      setPhase("review");
      return;
    }
    // Plan/seat purchases return a hosted Payment Link instead of an
    // order/subscription id — no Checkout.js popup involved, just send the
    // browser there. The callback_url set on the link (see checkout/route.ts)
    // brings it back to this same billing page afterward.
    if (resBody.paymentLinkUrl) {
      trackEvent("checkout_redirect", { kind: request.kind });
      window.location.href = resBody.paymentLinkUrl;
      return;
    }
    if (!window.Razorpay) {
      setError("Payments script failed to load. Please try again.");
      setPhase("review");
      return;
    }

    const razorpay = new window.Razorpay({
      key: resBody.keyId,
      subscription_id: resBody.subscriptionId,
      order_id: resBody.orderId,
      name: "VeloBot",
      description: title,
      theme: { color: "#4F46E5" },
      handler: async (response) => {
        await fetch("/api/razorpay/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(response),
        });
        trackEvent("checkout_completed", { kind: request.kind });
        onOpenChange(false);
        router.refresh();
      },
      modal: {
        ondismiss: () => {
          setPhase("review");
          onOpenChange(false);
        },
      },
    });
    // Our own dialog only ever showed the review/loading/error states —
    // close it now so Razorpay's modal is the only one visible.
    onOpenChange(false);
    razorpay.open();
  }

  function handleClose(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setError(null);
      setPhase("review");
    }
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" onLoad={() => setScriptLoaded(true)} />
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {!KEY_ID ? (
              <div className="py-8 text-center text-sm">
                <p className="font-medium text-status-critical">Checkout isn&apos;t configured yet.</p>
                <p className="mt-1 text-muted-foreground">
                  Set <code className="rounded bg-muted px-1 py-0.5 text-xs">NEXT_PUBLIC_RAZORPAY_KEY_ID</code> and the{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">RAZORPAY_PLAN_*</code> variables from{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.example</code> to enable billing.
                </p>
              </div>
            ) : phase === "processing" ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Preparing checkout...</p>
            ) : (
              <div className="flex flex-col gap-4 py-2">
                {error && <p className="text-sm text-status-critical">{error}</p>}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="coupon-code">Coupon code (optional)</Label>
                  <Input
                    id="coupon-code"
                    placeholder="e.g. LAUNCH20"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  />
                </div>
              </div>
            )}
          </DialogBody>
          {KEY_ID && phase === "review" && (
            <DialogFooter>
              <Button onClick={startCheckout} className="w-full">
                Continue to payment
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
