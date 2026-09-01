export const ROLES = ["admin", "agent"] as const;

/** Role hierarchy for permission checks — higher index = more privilege. Admin has every permission owner used to (billing, connections, actions, workspace settings, deleting the workspace). */
export const ROLE_RANK: Record<(typeof ROLES)[number], number> = {
  agent: 0,
  admin: 1,
};

export const CONVERSATION_STATUS = [
  "ai",
  "queued",
  "assigned",
  "resolved",
] as const;

export const SOURCE_TYPES = ["website", "pdf", "txt", "docx", "markdown"] as const;

export const MESSAGE_ROLES = ["user", "assistant", "agent", "system"] as const;

// Plan tiers, quotas, and pricing live in ./plans.ts (PLANS / ADDONS) —
// replaces the old PLAN_LIMITS constant.

/** How long a `queued` conversation may sit unassigned before an alert fires. */
export const ESCALATION_ALERT_THRESHOLD_SECONDS = 60;

export const CHUNK_TOKEN_SIZE = 800;
export const CHUNK_TOKEN_OVERLAP = 100;

export const EMBEDDING_DIMENSIONS = 1536;
export const EMBEDDING_BATCH_SIZE = 96;

export const RAG_MATCH_COUNT = 6;
// text-embedding-3-small cosine similarities for genuinely relevant
// content typically land in the 0.3-0.7 range, not 0.75+ — a higher
// threshold silently rejects real matches. Calibrated empirically against
// a live crawl: a question naming the company scored 0.63, a generic
// on-topic rewrite of the same question ("what services does the company
// offer?") scored 0.37 (the model leans on literal keyword overlap, not
// just meaning — a generic rewrite loses the company-name signal), while
// genuinely off-topic questions scored 0.19-0.22. 0.3 keeps the generic
// on-topic case while still excluding the off-topic ones, but note this
// model rewards keyword overlap enough that a hybrid (keyword + vector)
// search would be materially more robust than pure cosine similarity —
// worth it if retrieval quality matters for your deployment.
export const RAG_MATCH_THRESHOLD = 0.3;

export const CRAWLER_MAX_PAGES = 150;
export const CRAWLER_MAX_DEPTH = 4;

export const WIDGET_SESSION_STORAGE_KEY = "velobot_session";
