-- ─────────────────────────────────────────────────────────────────────────
-- VeloBot — Super Admin controls: editable plan pricing overrides, a
-- database-backed legal-pages CMS, and a purchase-coupon system.
-- Implements the contract in packages/shared/src/types/database.ts
-- (PlanPriceOverride, LegalPage, Coupon, CouponRedemption, plus the new
-- plan.update_price / legal.update_page / coupon.create / coupon.revoke
-- AdminAuditAction values).
--
-- Run this AFTER supabase/sql/010_razorpay_billing.sql.
-- Same caveat as every other file here: this is a testing/dev-setup aid,
-- not shipped application schema.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Plan pricing overrides ──────────────────────────────────────────────
-- Falls back to the static defaults in packages/shared/src/plans.ts when no
-- row exists for a given (tier, interval, currency) — see
-- lib/billing/plan-pricing.ts's getEffectivePrice(). `razorpay_plan_id` is
-- filled in separately once a matching Razorpay Plan is created to match
-- (requires Razorpay Subscriptions to be activated on the account — not
-- part of this migration, see PLAN.md context at implementation time).
create table plan_price_overrides (
  id               uuid primary key default gen_random_uuid(),
  tier             text not null check (tier in ('hobby', 'growth', 'business')),
  interval         text not null check (interval in ('monthly', 'yearly')),
  currency         text not null check (currency in ('USD', 'INR')),
  amount           integer not null check (amount >= 0),
  razorpay_plan_id text,
  updated_by       uuid not null references auth.users(id),
  updated_at       timestamptz not null default now(),
  unique (tier, interval, currency)
);

-- ── Legal pages (CMS-lite) ───────────────────────────────────────────────
-- Seeded below with the *existing* placeholder content from
-- app/legal/{terms,privacy,subprocessors}/page.tsx, converted to markdown
-- — not new legal text. Super Admin fills in the real company details via
-- the new admin/legal editor.
create table legal_pages (
  slug             text primary key check (slug in ('terms', 'privacy', 'subprocessors')),
  title            text not null,
  content_markdown text not null,
  updated_by       uuid references auth.users(id),
  updated_at       timestamptz not null default now()
);

-- ── Coupons ──────────────────────────────────────────────────────────────
-- `razorpay_offer_id` is required only when applies_to includes plan
-- subscriptions — Razorpay Offers cannot be created via API (dashboard
-- only, verified against current docs), so the Super Admin creates the
-- matching Offer in Razorpay's dashboard first and pastes the id here.
create table coupons (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  discount_type     text not null check (discount_type in ('percent', 'fixed')),
  discount_value    numeric not null check (discount_value > 0),
  applies_to        text not null check (applies_to in ('messages_addon', 'plan_subscription', 'all')),
  razorpay_offer_id text,
  max_redemptions   integer check (max_redemptions > 0),
  times_redeemed    integer not null default 0,
  expires_at        timestamptz,
  is_active         boolean not null default true,
  created_by        uuid not null references auth.users(id),
  created_at        timestamptz not null default now()
);
create index on coupons (code) where is_active;

-- ── Coupon redemptions ───────────────────────────────────────────────────
-- One redemption per org per coupon — the anti-abuse rule enforced by the
-- unique index, not application code alone.
create table coupon_redemptions (
  id                uuid primary key default gen_random_uuid(),
  coupon_id         uuid not null references coupons(id) on delete cascade,
  org_id            uuid not null references organizations(id) on delete cascade,
  purchase_kind     text not null check (purchase_kind in ('messages_addon', 'plan_subscription')),
  amount_discounted integer not null,
  redeemed_at       timestamptz not null default now(),
  unique (coupon_id, org_id)
);

-- ── RLS ─────────────────────────────────────────────────────────────────
-- Every route touching these four tables goes through the service-role
-- client (lib/billing/plan-pricing.ts, lib/legal/content.ts,
-- lib/billing/coupons.ts, the admin/* API routes) — RLS is enabled with
-- zero policies for defense in depth, not for RLS-scoped client access
-- (there isn't any for this feature, including the public /legal/* pages,
-- which read via the service-role client from a server component rather
-- than a public RLS policy).
alter table plan_price_overrides enable row level security;
alter table legal_pages enable row level security;
alter table coupons enable row level security;
alter table coupon_redemptions enable row level security;

-- ── Seed: legal_pages ────────────────────────────────────────────────────
-- Faithful markdown conversion of the existing placeholder JSX content in
-- app/legal/{terms,privacy,subprocessors}/page.tsx — not new legal text.
-- Real values (company name, address, jurisdiction, support email) are
-- still bracketed placeholders — fill them in via admin/legal once this
-- migration runs.
insert into legal_pages (slug, title, content_markdown) values
('terms', 'Terms of Service', $md$These Terms of Service ("Terms") govern access to and use of VeloBot, a website chatbot platform that lets a business ("you," "Customer") train a support bot on its own content, embed it on a website, and route conversations to human agents. They are a contract between you and **[YOUR COMPANY LEGAL NAME]** ("VeloBot," "we," "us"), a company registered at **[ADDRESS]**. By creating an account or embedding a VeloBot widget, you agree to these Terms.

## 1. The service

VeloBot provides: a dashboard for creating and configuring chatbots; a knowledge-base ingestion pipeline that crawls or accepts uploads of your own content; an AI chat runtime that answers your website visitors using that content; an embeddable widget; a live agent inbox for escalated conversations; optional integrations ("Connections" and "Bot Actions") that let a bot or agent call your own external systems; and, on qualifying plans, a read-only Developer API for pulling your own bots and conversations into other systems.

## 2. Accounts and eligibility

You must provide accurate information when creating an account and are responsible for activity under it, including actions taken by teammates you invite. You must be legally able to enter a binding contract in your jurisdiction.

## 3. Your content and your responsibility for it

- You represent that you have the right to submit any content you crawl, upload, or otherwise feed into a bot's knowledge base, and that doing so doesn't infringe anyone else's rights.
- Any custom instructions you write for a bot (system prompt additions, guardrail topics, canned replies, workflow rules) are your responsibility — we don't review them before they go live.
- If you enable the optional cookie/consent banner feature, configuring and displaying an adequate notice to your own website's visitors — consistent with the law in your and your visitors' jurisdictions — is your responsibility, not ours; VeloBot provides the mechanism, not legal advice on what it must say.
- You're responsible for how your team uses agent tools (claiming conversations, quick actions, Bot Actions that call your own systems) and for any external API credentials you connect through Connections.

## 4. Acceptable use

You won't use VeloBot to:

- Train or configure a bot to deceive visitors about the fact that they're talking to an AI when asked directly.
- Collect sensitive personal data from visitors beyond what's reasonably necessary for support (e.g. don't repurpose the chat as a form for collecting government ID numbers, health information, or financial account details).
- Attempt to bypass plan limits, rate limits, or the Developer API's scope (read-only, your own org's data).
- Send unsolicited bulk messages, malware, or attempt to compromise the platform's security.
- Reverse-engineer the widget or platform beyond what's allowed by law.

## 5. Fees and billing

Paid plans are billed in advance (monthly or yearly) via Razorpay. Add-ons (extra agent seats, extra AI messages) are billed as configured at purchase. Fees are non-refundable except where required by law or stated otherwise. We may change plan pricing with notice before your next billing cycle; continuing to use a paid plan after a price change takes effect means you accept the new price. Failing to pay may result in suspended access after a grace period.

## 6. AI-generated responses

A bot's replies are generated by a third-party large language model based on the content you provided, and are provided "as is." VeloBot does not guarantee accuracy, and neither VeloBot nor you should treat AI-generated sentiment, intent, or entity extraction as verified fact — it's a hint for your team, not a source of truth. You're responsible for reviewing bot behavior and disabling or correcting it (via guardrails, workflow rules, or human escalation) if it produces answers you don't want given on your behalf.

## 7. Intellectual property

You retain ownership of your content and configuration. We retain ownership of the VeloBot platform, widget, and underlying technology. We may use aggregated, de-identified usage data (not your visitors' conversation content) to improve the service.

## 8. Suspension and termination

We may suspend or terminate an account for material breach of these Terms, non-payment, or activity that risks harm to the platform or other customers. You may cancel at any time from Billing; cancellation takes effect at the end of the current billing period.

## 9. Disclaimers and limitation of liability

The service is provided "as is" without warranties of any kind, express or implied. To the maximum extent permitted by law, VeloBot's total liability for any claim arising from these Terms or the service is limited to the amount you paid us in the twelve months before the claim, and we aren't liable for indirect, incidental, or consequential damages.

## 10. Governing law

These Terms are governed by the laws of **[GOVERNING LAW / JURISDICTION]**, without regard to conflict-of-law rules.

## 11. Changes to these Terms

We'll post updates here and, for material changes, notify account admins by email. Continued use after a change takes effect means you accept it.

## 12. Contact

Questions about these Terms: **[SUPPORT EMAIL]**.$md$),

('privacy', 'Privacy Policy', $md$This policy explains how **[YOUR COMPANY LEGAL NAME]** ("VeloBot") handles personal data. It covers two different groups, because VeloBot sits between them: **Customers** (the businesses who sign up for a VeloBot account, and the teammates they invite), and **Visitors** (people who chat with a VeloBot widget embedded on a Customer's website). If you're a Visitor with a question about a specific conversation, the business you were chatting with — not VeloBot — is usually the right first contact, since they configured that bot; see "Your rights" below either way.

## 1. Data we collect from Customers

- Account data: email, name, organization name, role (admin or agent).
- Billing data: plan, billing address, and payment details — payment card details are handled directly by Razorpay and never touch our servers.
- Content you provide: crawled or uploaded knowledge-base content, bot configuration (guardrails, workflow rules, canned replies, custom instructions), and any external API credentials you add under Connections.
- Usage data: login activity, feature usage, and the Super Admin support/audit trail if you contact support.

## 2. Data we collect from Visitors, on a Customer's behalf

When someone chats with an embedded VeloBot widget, we process, on behalf of the Customer running that bot:

- The conversation itself — every message sent and received, including any file or screenshot attached.
- An email address, if the Visitor provides one (e.g. to reach an agent, or to leave a message when no one's online).
- The page URL the widget was embedded on, and an IP-derived approximate location, for context shown to the agent handling the conversation.
- A post-conversation satisfaction rating (1–5 stars, plus an optional comment), if the Visitor chooses to leave one.
- If the Customer has enabled it, an AI-generated best-effort guess at the conversation's intent, sentiment, and any entities (like an order number) mentioned — always shown to the Customer's agents as an unverified hint, never treated as fact.
- A random session identifier stored in the Visitor's browser (localStorage), so a returning Visitor sees their own conversation history rather than starting over.

For this Visitor-facing data, the Customer is the data controller and VeloBot is the data processor — we handle it under the Customer's instructions (their bot configuration) and Terms of Service with us, not under a direct relationship with the Visitor.

## 3. How we use this data

- To operate the service: answering chats, routing escalations, showing agents the conversation history and context they need.
- To send transactional email: team invites, notifications about an unassigned or offline conversation, billing receipts.
- To enforce plan limits and prevent abuse (rate limiting).
- To improve the platform, using aggregated and de-identified data only.

## 4. Who we share it with

We share data with the sub-processors who help us run the service — OpenAI (generating chat responses and the optional intent/sentiment extraction), Supabase (database, authentication, file storage, realtime messaging), Razorpay (billing), Resend (transactional email), and Upstash (rate limiting) — each bound by their own data-processing terms. See the full [Sub-processors](/legal/subprocessors) list. We don't sell personal data, ever.

## 5. Data retention

Account data is kept for as long as your account is active. Conversation data is kept to give Customers a usable support history and to power features like returning-visitor context — see our data retention notes for the current stance, and contact **[SUPPORT EMAIL]** if you need something deleted sooner. If a bot has the optional PII-redaction guardrail enabled, credit-card- and SSN-like number patterns are stripped from the assistant's stored replies before they're saved — this is a narrow, best-effort safety net, not a general data-minimization guarantee for everything a Visitor might type.

## 6. Cookies and local storage

The widget stores a session identifier in the Visitor's browser (localStorage, not a tracking cookie) purely to remember their own conversation. If a Customer enables the optional consent banner, the widget shows a short notice the first time it opens — this is a courtesy notice the Customer configures, not a substitute for whatever cookie-consent tooling the Customer's own website already uses.

## 7. Security

Data is stored with row-level access controls scoped per organization, service-role credentials are never exposed to the browser, and origin allowlisting restricts which websites can embed a given bot. No method of transmission or storage is 100% secure, but we design around the principle that one Customer's data should never be reachable by another.

## 8. Your rights

Depending on where you live, you may have the right to access, correct, export, or delete personal data we hold about you. Customers can reach us at **[SUPPORT EMAIL]** (or **[DPO CONTACT]** for data protection officer inquiries). A Visitor asking about a specific conversation should generally start with the business they chatted with, since that business configured and controls that bot — we'll assist them in fulfilling a verified request either way.

## 9. Children

VeloBot isn't directed at children, and Customers shouldn't knowingly deploy a bot to collect personal data from children without appropriate consent under applicable law.

## 10. International transfers

Data may be processed in countries other than your own, using our sub-processors' own safeguards for international transfers.

## 11. Changes to this policy

We'll update the date at the top of this page and notify account admins by email for material changes.

## 12. Contact

**[YOUR COMPANY LEGAL NAME]**, **[ADDRESS]** — **[SUPPORT EMAIL]**.$md$),

('subprocessors', 'Sub-processors', $md$These are the third-party services VeloBot uses to operate the platform, each processing data only as needed to provide their part of the service and bound by their own data-processing agreements. We'll update this list before adding a new sub-processor that would materially change how your data is handled.

| Sub-processor | Purpose | Location |
|---|---|---|
| OpenAI | Generates chat responses; powers the optional intent/sentiment/entity extraction feature. | United States |
| Supabase | Primary database, authentication, file/attachment storage, and realtime messaging between the widget and agent inbox. | United States |
| Razorpay | Billing and payment processing. Card and payment details are handled directly by Razorpay and never touch VeloBot's servers. | India |
| Resend | Delivers transactional email (team invites, unassigned-conversation and offline-message notifications). | United States |
| Upstash | Rate limiting for the chat widget and the Developer API. | United States / global edge |
| Sentry | Error monitoring for the dashboard, inbox, and chat API — active only once an account admin configures it. | United States |
| PostHog | Product analytics (e.g. signup and checkout funnel) — active only once an account admin configures it. | United States / EU |

Questions about a specific sub-processor: **[SUPPORT EMAIL]**.$md$);
