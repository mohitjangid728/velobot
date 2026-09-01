import type { WidgetSession } from "./types";

const STORAGE_KEY_PREFIX = "velobot_session";
const MAX_HISTORY = 20;

function key(botId: string) {
  return `${STORAGE_KEY_PREFIX}:${botId}`;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Loads the persisted session for this bot, or creates a fresh one. This is
 * what survives page reloads — the visitor doesn't lose their conversation
 * navigating between pages on the same site.
 */
export function loadSession(botId: string): WidgetSession {
  try {
    const raw = localStorage.getItem(key(botId));
    if (raw) {
      const parsed = JSON.parse(raw) as WidgetSession;
      if (parsed.sessionId) return parsed;
    }
  } catch {
    // localStorage may be unavailable (private browsing, disabled cookies) — fall through to a fresh in-memory session.
  }
  return { sessionId: randomId(), conversationId: null, mode: "ai", history: [] };
}

export function saveSession(botId: string, session: WidgetSession) {
  try {
    const trimmed: WidgetSession = { ...session, history: session.history.slice(-MAX_HISTORY) };
    localStorage.setItem(key(botId), JSON.stringify(trimmed));
  } catch {
    // Best-effort persistence only — the widget still works within the current page load.
  }
}
