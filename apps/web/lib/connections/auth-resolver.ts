import "server-only";
import type { Connection, ConnectionAuthConfig } from "@velobot/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Deliberately not Node's `crypto` module — `executeAction`/`pingConnection`
 * are reachable from app/api/chat/stream/route.ts, which runs on the Edge
 * runtime (`export const runtime = "edge"`), where Node built-ins aren't
 * available. The Web Crypto API (`globalThis.crypto.subtle`) works
 * identically on both the Edge runtime and Node 20+ (this repo's minimum),
 * so every helper below is written against it — no runtime branching needed.
 */
const TOKEN_EXCHANGE_TIMEOUT_MS = 8000;

export interface ResolvedAuth {
  headers: Record<string, string>;
  queryParams: Record<string, string>;
}

/**
 * Turns a Connection's configured auth mechanism into the headers/query
 * params to attach to one specific request. This is the one place
 * executeAction.ts and pingConnection() ask "how do I authenticate this
 * call" — neither needs to know anything about OAuth2 token caching or
 * OAuth1 signing beyond calling this function.
 */
export async function resolveConnectionAuth(
  connection: Connection,
  request: { method: string; url: string }
): Promise<ResolvedAuth> {
  // Rows written before ConnectionAuthType existed have no auth_type at
  // all — treat that the same as "custom_headers" (the only mechanism
  // that existed then), so nothing already configured breaks.
  const authType = connection.auth_type ?? "custom_headers";
  const config = connection.auth_config;

  switch (authType) {
    case "custom_headers":
      return { headers: {}, queryParams: {} };

    case "api_key": {
      if (config.type !== "api_key") return { headers: {}, queryParams: {} };
      return config.location === "query"
        ? { headers: {}, queryParams: { [config.header_name]: config.api_key } }
        : { headers: { [config.header_name]: config.api_key }, queryParams: {} };
    }

    case "bearer_token": {
      if (config.type !== "bearer_token") return { headers: {}, queryParams: {} };
      return { headers: { Authorization: `Bearer ${config.token}` }, queryParams: {} };
    }

    case "jwt": {
      if (config.type !== "jwt") return { headers: {}, queryParams: {} };
      return { headers: { Authorization: `Bearer ${config.token}` }, queryParams: {} };
    }

    case "basic_auth": {
      if (config.type !== "basic_auth") return { headers: {}, queryParams: {} };
      return { headers: { Authorization: `Basic ${btoa(`${config.username}:${config.password}`)}` }, queryParams: {} };
    }

    case "oauth2": {
      if (config.type !== "oauth2") return { headers: {}, queryParams: {} };
      const accessToken = await getValidOAuth2AccessToken(connection, config);
      return { headers: { Authorization: `Bearer ${accessToken}` }, queryParams: {} };
    }

    case "oauth1": {
      if (config.type !== "oauth1") return { headers: {}, queryParams: {} };
      const authHeader = await signOAuth1Request(config, request.method, request.url);
      return { headers: { Authorization: authHeader }, queryParams: {} };
    }

    default:
      return { headers: {}, queryParams: {} };
  }
}

// ── OAuth 2.0: client_credentials / refresh_token, with on-demand refresh ──

const REFRESH_SKEW_MS = 60_000; // refresh a minute before actual expiry, not exactly at it

async function persistOAuth2Token(
  connectionId: string,
  config: Extract<ConnectionAuthConfig, { type: "oauth2" }>
): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from("connections").update({ auth_config: config, updated_at: new Date().toISOString() }).eq("id", connectionId);
}

async function logOAuthRefresh(connection: Connection, ok: boolean, latencyMs: number, error?: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from("connection_logs").insert({
    connection_id: connection.id,
    org_id: connection.org_id,
    action_id: null,
    source: "oauth_refresh",
    request_method: "POST",
    request_path: "(token endpoint)",
    request_body: null,
    response_status: ok ? 200 : null,
    response_body: null, // token values are never logged, success or failure
    latency_ms: latencyMs,
    error_message: error ?? null,
  });
}

/**
 * Returns a valid access token, refreshing it first if it's missing or
 * within a minute of expiry. The refreshed token (and any rotated refresh
 * token) is written straight back onto the connection row — the very next
 * call, from any request, reuses the cached token with no extra round trip.
 */
async function getValidOAuth2AccessToken(
  connection: Connection,
  config: Extract<ConnectionAuthConfig, { type: "oauth2" }>
): Promise<string> {
  if (config.access_token && config.expires_at && new Date(config.expires_at).getTime() - Date.now() > REFRESH_SKEW_MS) {
    return config.access_token;
  }

  if (config.grant_type === "refresh_token" && !config.refresh_token) {
    throw new Error("This connection's OAuth 2.0 setup is missing a refresh token.");
  }

  const body = new URLSearchParams({
    grant_type: config.grant_type,
    client_id: config.client_id,
    client_secret: config.client_secret,
  });
  if (config.grant_type === "client_credentials" && config.scope) body.set("scope", config.scope);
  if (config.grant_type === "refresh_token" && config.refresh_token) body.set("refresh_token", config.refresh_token);

  const started = Date.now();
  try {
    const res = await fetch(config.token_url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(TOKEN_EXCHANGE_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Token endpoint responded with HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    }
    const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!json.access_token) throw new Error("Token endpoint response had no access_token");

    const updated: Extract<ConnectionAuthConfig, { type: "oauth2" }> = {
      ...config,
      access_token: json.access_token,
      refresh_token: json.refresh_token ?? config.refresh_token,
      expires_at: new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString(),
    };
    await persistOAuth2Token(connection.id, updated);
    await logOAuthRefresh(connection, true, Date.now() - started);
    return updated.access_token!;
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth token refresh failed";
    await logOAuthRefresh(connection, false, Date.now() - started, message);
    throw new Error(`OAuth token refresh failed: ${message}`);
  }
}

// ── OAuth 1.0a: RFC 5849 HMAC-SHA1 request signing ──────────────────────

/** RFC 3986 percent-encoding — stricter than encodeURIComponent, which leaves !'()* unescaped. */
function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

async function hmacSha1Base64(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function signOAuth1Request(
  config: Extract<ConnectionAuthConfig, { type: "oauth1" }>,
  method: string,
  url: string
): Promise<string> {
  const parsed = new URL(url);
  const baseUrl = `${parsed.origin}${parsed.pathname}`;

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: config.consumer_key,
    oauth_token: config.access_token,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_nonce: crypto.randomUUID().replace(/-/g, ""),
    oauth_version: "1.0",
  };

  // The signature base string includes the query string (so a signed GET
  // Action's params are covered, matching real OAuth1 APIs like Twitter)
  // but never a JSON body — OAuth1 only ever signs
  // application/x-www-form-urlencoded params, and this app's POST/PUT
  // bodies are always JSON.
  const allParams: Record<string, string> = { ...oauthParams };
  for (const [key, value] of parsed.searchParams) allParams[key] = value;

  const paramString = Object.keys(allParams)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(allParams[key]!)}`)
    .join("&");

  const signatureBase = `${method.toUpperCase()}&${percentEncode(baseUrl)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(config.consumer_secret)}&${percentEncode(config.access_token_secret)}`;
  const signature = await hmacSha1Base64(signingKey, signatureBase);

  const headerParams: Record<string, string> = { ...oauthParams, oauth_signature: signature };
  const headerValue = Object.keys(headerParams)
    .map((key) => `${percentEncode(key)}="${percentEncode(headerParams[key]!)}"`)
    .join(", ");

  return `OAuth ${headerValue}`;
}
