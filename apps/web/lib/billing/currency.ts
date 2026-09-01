import "server-only";
import type { Currency } from "@velobot/shared";

/**
 * Best-effort country detection from whichever geolocation header the
 * hosting platform populates — Vercel (`x-vercel-ip-country`) and
 * Cloudflare (`cf-ipcountry`) are the two most common. This only picks the
 * pricing page's *default* currency toggle state; the visitor can always
 * override it manually, so a missing/wrong header just means a slightly
 * wrong default, not a broken page.
 */
export function detectCurrency(headers: Headers): Currency {
  const country = headers.get("x-vercel-ip-country") ?? headers.get("cf-ipcountry") ?? "";
  return country.toUpperCase() === "IN" ? "INR" : "USD";
}
