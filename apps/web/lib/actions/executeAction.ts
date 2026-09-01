import "server-only";
import type { BotAction, Connection, ActionLogSource } from "@velobot/shared";
import { buildRequestUrl, headersToFetchHeaders, logExecution, EXECUTION_TIMEOUT_MS } from "@/lib/connections/connections-manager";
import { resolveConnectionAuth } from "@/lib/connections/auth-resolver";

export type ActionParamValue = string | number | boolean;

export interface ExecuteActionInput {
  action: BotAction;
  connection: Connection;
  params: Record<string, ActionParamValue>;
  source: ActionLogSource;
}

export interface ActionExecutionResult {
  ok: boolean;
  status: number | null;
  body: unknown;
  error?: string;
}

/**
 * Path-parameter convention: any extracted param whose name matches a
 * `{placeholder}` in the path is substituted there and removed from the
 * remaining set; everything left over becomes a query string (GET) or JSON
 * body (POST/PUT). One rule, shared by the runtime and the tester.
 */
export function applyPathParams(
  path: string,
  params: Record<string, ActionParamValue>
): { resolvedPath: string; remaining: Record<string, ActionParamValue> } {
  const remaining = { ...params };
  const resolvedPath = path.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = remaining[key];
    delete remaining[key];
    return encodeURIComponent(value === undefined ? "" : String(value));
  });
  return { resolvedPath, remaining };
}

const MAX_LOGGED_BODY_CHARS = 8000;

function truncate(value: unknown, maxChars: number): unknown {
  const str = typeof value === "string" ? value : JSON.stringify(value);
  if (!str || str.length <= maxChars) return value;
  return str.slice(0, maxChars) + "…(truncated)";
}

/** Bounds what gets sent back into the LLM's context — separate cap from the audit log, since token cost matters here specifically. */
export function truncateForModel(body: unknown, maxChars = 4000): string {
  const str = JSON.stringify(body);
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars) + '…"(truncated)"';
}

export async function executeAction({ action, connection, params, source }: ExecuteActionInput): Promise<ActionExecutionResult> {
  const started = Date.now();
  const { resolvedPath, remaining } = applyPathParams(action.path, params);

  let url = buildRequestUrl(connection, resolvedPath);
  const headers = new Headers(headersToFetchHeaders(connection.headers));
  let requestBody: string | undefined;
  let requestBodyForLog: unknown = null;

  if (action.method === "GET") {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(remaining)) qs.set(key, String(value));
    const qsString = qs.toString();
    if (qsString) url += (url.includes("?") ? "&" : "?") + qsString;
  } else {
    headers.set("Content-Type", "application/json");
    requestBody = JSON.stringify(remaining);
    requestBodyForLog = remaining;
  }

  let result: ActionExecutionResult;
  try {
    // Resolved against the final URL (including any GET query string) so
    // OAuth1 signing — which must cover the exact request being sent —
    // and OAuth2's on-demand token refresh both see the real request.
    const resolvedAuth = await resolveConnectionAuth(connection, { method: action.method, url });
    for (const [key, value] of Object.entries(resolvedAuth.headers)) headers.set(key, value);
    const authQuery = new URLSearchParams(resolvedAuth.queryParams).toString();
    if (authQuery) url += (url.includes("?") ? "&" : "?") + authQuery;

    const res = await fetch(url, {
      method: action.method,
      headers,
      body: requestBody,
      signal: AbortSignal.timeout(EXECUTION_TIMEOUT_MS),
    });
    const text = await res.text();
    let parsedBody: unknown = text || null;
    try {
      parsedBody = text ? JSON.parse(text) : null;
    } catch {
      // Not JSON — keep the raw text; the LLM can still work with plain text results.
    }
    result = {
      ok: res.ok,
      status: res.status,
      body: parsedBody,
      error: res.ok ? undefined : `Request failed with HTTP ${res.status}`,
    };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    result = {
      ok: false,
      status: null,
      body: null,
      error: timedOut ? "Request timed out after 8s" : err instanceof Error ? err.message : "Network error",
    };
  }

  await logExecution({
    connection_id: connection.id,
    org_id: connection.org_id,
    action_id: action.id,
    source,
    request_method: action.method,
    request_path: resolvedPath,
    request_body: requestBodyForLog,
    response_status: result.status,
    response_body: truncate(result.body, MAX_LOGGED_BODY_CHARS),
    latency_ms: Date.now() - started,
    error_message: result.error ?? null,
  });

  return result;
}
