"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogTitle } from "@/components/ui/dialog";
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

/**
 * Razorpay Checkout is a self-contained popup, not an embeddable iframe
 * like Stripe's — this component's own <Dialog> only covers the brief
 * "preparing checkout" / error states between clicking a plan and
 * Razorpay's own modal opening; the two are never shown stacked.
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
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const startedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !request || !scriptLoaded) return;
    // Guards against re-running for the same request if this effect
    // re-fires (e.g. router.refresh() re-rendering the parent) before the
    // dialog has actually been reopened for a new one.
    const requestKey = JSON.stringify(request);
    if (startedRef.current === requestKey) return;
    startedRef.current = requestKey;

    setError(null);
    (async () => {
      const res = await fetch("/api/razorpay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not start checkout");
        return;
      }
      if (!window.Razorpay) {
        setError("Payments script failed to load. Please try again.");
        return;
      }

      const razorpay = new window.Razorpay({
        key: body.keyId,
        subscription_id: body.subscriptionId,
        order_id: body.orderId,
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
            startedRef.current = null;
            onOpenChange(false);
          },
        },
      });
      // Our own dialog only ever showed a loading/error state — close it
      // now so Razorpay's modal is the only one visible.
      onOpenChange(false);
      razorpay.open();
    })();
  }, [open, request, scriptLoaded, title, onOpenChange, router]);

  function handleClose(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setError(null);
      startedRef.current = null;
    }
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" onLoad={() => setScriptLoaded(true)} />
      <Dialog open={open && (!!error || !KEY_ID)} onOpenChange={handleClose}>
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
            ) : error ? (
              <p className="py-8 text-center text-sm text-status-critical">{error}</p>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Preparing checkout...</p>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
