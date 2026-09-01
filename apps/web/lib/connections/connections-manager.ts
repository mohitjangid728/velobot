import "server-only";
import type { Connection, ConnectionAuthConfig, ConnectionLog, ActionLogSource, CreateConnectionInput, UpdateConnectionInput } from "@velobot/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveConnectionAuth } from "@/lib/connections/auth-resolver";

const EXECUTION_TIMEOUT_MS = 8000;

export async function listConnections(orgId: string): Promise<Connection[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("connections").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
  return (data ?? []) as Connection[];
}

export async function getConnection(orgId: string, id: string): Promise<Connection | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("connections").select("*").eq("org_id", orgId).eq("id", id).maybeSingle();
  return (data as Connection) ?? null;
}

export async function createConnection(orgId: string, input: CreateConnectionInput): Promise<Connection> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("connections").insert({ org_id: orgId, ...input }).select().single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create connection");
  return data as Connection;
}

export async function updateConnection(orgId: string, id: string, input: UpdateConnectionInput): Promise<Connection> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("connections")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("id", id)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to update connection");
  return data as Connection;
}

export async function deleteConnection(orgId: string, id: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from("connections").delete().eq("org_id", orgId).eq("id", id);
}

/** Strips a trailing slash from base_url and ensures path starts with exactly one leading slash. */
export function buildRequestUrl(connection: Pick<Connection, "base_url">, path: string): string {
  const base = connection.base_url.replace(/\/+$/, "");
  const rel = "/" + path.replace(/^\/+/, "");
  return base + rel;
}

export function headersToFetchHeaders(headers: Connection["headers"]): HeadersInit {
  const out: Record<string, string> = {};
  for (const { key, value } of headers) out[key] = value;
  return out;
}

/** "Bearer sk_live_abc123" -> "Bearer ••••c123" — used only in list responses, never on the edit-fetch. */
export function maskHeaderValue(value: string): string {
  if (value.length <= 4) return "••••";
  const tail = value.slice(-4);
  const prefixMatch = value.match(/^([A-Za-z-]+ )/); // e.g. "Bearer "
  const prefix = prefixMatch ? prefixMatch[1] : "";
  return `${prefix}••••${tail}`;
}

/** Which fields of each auth_config shape are secrets — everything else (token_url, grant_type, scope, username, ...) is not sensitive enough to hide. */
const SENSITIVE_AUTH_FIELDS: Record<string, readonly string[]> = {
  custom_headers: [],
  api_key: ["api_key"],
  bearer_token: ["token"],
  basic_auth: ["password"],
  jwt: ["token"],
  oauth2: ["client_secret", "access_token", "refresh_token"],
  oauth1: ["consumer_secret", "access_token_secret"],
};

export function maskAuthConfig(config: ConnectionAuthConfig): ConnectionAuthConfig {
  const sensitiveKeys = SENSITIVE_AUTH_FIELDS[config.type] ?? [];
  if (sensitiveKeys.length === 0) return config;
  const masked = { ...config } as Record<string, unknown>;
  for (const key of sensitiveKeys) {
    const value = masked[key];
    if (typeof value === "string" && value) masked[key] = maskHeaderValue(value);
  }
  return masked as ConnectionAuthConfig;
}

/** Used everywhere a connection is sent to the client except the single-connection edit-fetch (admin-gated, needs real values to prefill the form). */
export function maskConnectionHeaders(connection: Connection): Connection {
  return {
    ...connection,
    headers: connection.headers.map((h) => ({ key: h.key, value: maskHeaderValue(h.value) })),
    auth_config: maskAuthConfig(connection.auth_config ?? { type: "custom_headers" }),
  };
}

export async function logExecution(entry: Omit<ConnectionLog, "id" | "created_at">): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from("connection_logs").insert(entry);
}

export interface PingResult {
  ok: boolean;
  status: number | null;
  latencyMs: number;
  error?: string;
}

/**
 * Lightweight reachability + auth check: HEAD first (cheapest), falling
 * back to a single GET retry if the server doesn't support HEAD (405) or
 * refuses it outright — some APIs only implement GET on their base path.
 * Resolves the connection's real auth_type (OAuth2 exchange, OAuth1
 * signing, ...) first, so "Test" genuinely exercises whatever credential
 * mechanism is configured, not just reachability.
 */
export async function pingConnection(connection: Connection): Promise<PingResult> {
  const url = connection.base_url;
  const started = Date.now();

  async function attempt(method: "HEAD" | "GET"): Promise<Response> {
    const resolved = await resolveConnectionAuth(connection, { method, url });
    const headers = { ...headersToFetchHeaders(connection.headers), ...resolved.headers };
    let requestUrl = url;
    const qs = new URLSearchParams(resolved.queryParams).toString();
    if (qs) requestUrl += (requestUrl.includes("?") ? "&" : "?") + qs;
    return fetch(requestUrl, { method, headers, signal: AbortSignal.timeout(EXECUTION_TIMEOUT_MS) });
  }

  let result: PingResult;
  try {
    let res = await attempt("HEAD");
    if (res.status === 405) res = await attempt("GET");
    result = { ok: res.ok, status: res.status, latencyMs: Date.now() - started };
    if (!res.ok) result.error = `Endpoint responded with HTTP ${res.status}`;
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    result = {
      ok: false,
      status: null,
      latencyMs: Date.now() - started,
      error: timedOut ? "Request timed out after 8s" : err instanceof Error ? err.message : "Network error",
    };
  }

  await logExecution({
    connection_id: connection.id,
    org_id: connection.org_id,
    action_id: null,
    source: "ping" as ActionLogSource,
    request_method: "HEAD",
    request_path: "/",
    request_body: null,
    response_status: result.status,
    response_body: null,
    latency_ms: result.latencyMs,
    error_message: result.error ?? null,
  });

  return result;
}

const LOGS_PAGE_SIZE = 30;

export interface ConnectionLogsPage {
  logs: ConnectionLog[];
  nextCursor: string | null;
}

/** Cursor is the `created_at` of the last row on the previous page — simpler than offset pagination and stable under new inserts. */
export async function listConnectionLogs(connectionId: string, cursor?: string | null): Promise<ConnectionLogsPage> {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("connection_logs")
    .select("*")
    .eq("connection_id", connectionId)
    .order("created_at", { ascending: false })
    .limit(LOGS_PAGE_SIZE);
  if (cursor) query = query.lt("created_at", cursor);

  const { data } = await query;
  const logs = (data ?? []) as ConnectionLog[];
  const nextCursor = logs.length === LOGS_PAGE_SIZE ? logs[logs.length - 1]!.created_at : null;
  return { logs, nextCursor };
}

export { EXECUTION_TIMEOUT_MS };
