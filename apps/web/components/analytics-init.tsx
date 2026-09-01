"use client";

import { useEffect } from "react";
import { initPosthog } from "@/lib/analytics/posthog";

/** Renders nothing — just runs initPosthog() once on mount. A no-op when NEXT_PUBLIC_POSTHOG_KEY isn't set. */
export function AnalyticsInit() {
  useEffect(() => {
    initPosthog();
  }, []);
  return null;
}
