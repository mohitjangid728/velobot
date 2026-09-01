"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client for Client Components (Realtime subscriptions, client-side auth forms). */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
