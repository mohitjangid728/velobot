# Data retention

Internal note, not a public page — the public-facing stance is summarized in
`app/legal/privacy/page.tsx` §5 and should stay consistent with whatever is
decided here.

## Current state (as of this document)

Nothing in the codebase automatically deletes conversation data. Every
table — `conversations`, `messages`, `conversation_ratings`,
`bot_workflow_rule_hits`, `connection_logs`, `admin_audit_log` — is
insert/update only from the application's own code; nothing runs a
scheduled purge. Data is deleted only when:

- A bot is deleted (`on delete cascade` removes its conversations/messages).
- An org is deleted, self-serve or by a Super Admin (cascades everything).
- A Super Admin manually removes something via the platform console.

## Why this document exists, and what it deliberately does NOT do

The launch-readiness audit that produced this batch of work flagged "no
documented data-retention policy" as a real gap — Customers and their
Visitors have no stated answer to "how long is my data kept?" This document
records the current *technical* reality so a real policy can be written
against it. It intentionally does **not** ship an automated deletion job as
part of this batch: silently purging real customer conversation data on a
timer is a decision with genuine downside (an agent losing history they
needed, a compliance request landing after the window closes) that should
be made explicitly by the business, not defaulted into existence by an
engineering pass.

## Decisions still needed before the Privacy Policy's retention section can be finalized

1. **A concrete retention window** for conversation data (e.g. "24 months
   after the conversation's last message"), if one is wanted at all.
2. **Whether resolved-and-rated conversations should retain less** than
   ones still relevant to an open dispute or support ticket.
3. **Whether a Customer-initiated deletion request** (e.g. from Settings)
   should be self-serve or routed through support.
4. **Whether `admin_audit_log`** (Super Admin actions) should ever be
   pruned, given it's the platform's own accountability trail — most
   comparable products keep this indefinitely.

Once these are decided, the natural implementation is a scheduled job
(Supabase's own `pg_cron`, or a Vercel Cron hitting a new internal route
mirroring `app/api/internal/notify-unassigned/route.ts`'s auth pattern)
that deletes conversations older than the chosen window — at that point,
update the Privacy Policy's §5 to state the real number instead of pointing
here.
