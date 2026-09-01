import Link from "next/link";
import { LegalPageShell } from "@/components/marketing/legal-page-shell";

export const metadata = { title: "Privacy Policy — VeloBot" };

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy" updatedAt="[DATE]">
      <p>
        This policy explains how <strong>[YOUR COMPANY LEGAL NAME]</strong> (&ldquo;VeloBot&rdquo;) handles personal data. It
        covers two different groups, because VeloBot sits between them: <strong>Customers</strong> (the businesses who sign up
        for a VeloBot account, and the teammates they invite), and <strong>Visitors</strong> (people who chat with a VeloBot
        widget embedded on a Customer&apos;s website). If you&apos;re a Visitor with a question about a specific conversation,
        the business you were chatting with — not VeloBot — is usually the right first contact, since they configured that
        bot; see &ldquo;Your rights&rdquo; below either way.
      </p>

      <h2>1. Data we collect from Customers</h2>
      <ul>
        <li>Account data: email, name, organization name, role (admin or agent).</li>
        <li>Billing data: plan, billing address, and payment details — payment card details are handled directly by Razorpay and never touch our servers.</li>
        <li>Content you provide: crawled or uploaded knowledge-base content, bot configuration (guardrails, workflow rules, canned replies, custom instructions), and any external API credentials you add under Connections.</li>
        <li>Usage data: login activity, feature usage, and the Super Admin support/audit trail if you contact support.</li>
      </ul>

      <h2>2. Data we collect from Visitors, on a Customer&apos;s behalf</h2>
      <p>When someone chats with an embedded VeloBot widget, we process, on behalf of the Customer running that bot:</p>
      <ul>
        <li>The conversation itself — every message sent and received, including any file or screenshot attached.</li>
        <li>An email address, if the Visitor provides one (e.g. to reach an agent, or to leave a message when no one&apos;s online).</li>
        <li>The page URL the widget was embedded on, and an IP-derived approximate location, for context shown to the agent handling the conversation.</li>
        <li>A post-conversation satisfaction rating (1–5 stars, plus an optional comment), if the Visitor chooses to leave one.</li>
        <li>If the Customer has enabled it, an AI-generated best-effort guess at the conversation&apos;s intent, sentiment, and any entities (like an order number) mentioned — always shown to the Customer&apos;s agents as an unverified hint, never treated as fact.</li>
        <li>A random session identifier stored in the Visitor&apos;s browser (localStorage), so a returning Visitor sees their own conversation history rather than starting over.</li>
      </ul>
      <p>
        For this Visitor-facing data, the Customer is the data controller and VeloBot is the data processor — we handle it
        under the Customer&apos;s instructions (their bot configuration) and Terms of Service with us, not under a direct
        relationship with the Visitor.
      </p>

      <h2>3. How we use this data</h2>
      <ul>
        <li>To operate the service: answering chats, routing escalations, showing agents the conversation history and context they need.</li>
        <li>To send transactional email: team invites, notifications about an unassigned or offline conversation, billing receipts.</li>
        <li>To enforce plan limits and prevent abuse (rate limiting).</li>
        <li>To improve the platform, using aggregated and de-identified data only.</li>
      </ul>

      <h2>4. Who we share it with</h2>
      <p>
        We share data with the sub-processors who help us run the service — OpenAI (generating chat responses and the optional
        intent/sentiment extraction), Supabase (database, authentication, file storage, realtime messaging), Razorpay (billing),
        Resend (transactional email), and Upstash (rate limiting) — each bound by their own data-processing terms. See the
        full <Link href="/legal/subprocessors">Sub-processors</Link> list. We don&apos;t sell personal data, ever.
      </p>

      <h2>5. Data retention</h2>
      <p>
        Account data is kept for as long as your account is active. Conversation data is kept to give Customers a usable
        support history and to power features like returning-visitor context — see our{" "}
        <strong>data retention notes</strong> for the current stance, and contact <strong>[SUPPORT EMAIL]</strong> if you need
        something deleted sooner. If a bot has the optional PII-redaction guardrail enabled, credit-card- and SSN-like number
        patterns are stripped from the assistant&apos;s stored replies before they&apos;re saved — this is a narrow, best-effort
        safety net, not a general data-minimization guarantee for everything a Visitor might type.
      </p>

      <h2>6. Cookies and local storage</h2>
      <p>
        The widget stores a session identifier in the Visitor&apos;s browser (localStorage, not a tracking cookie) purely to
        remember their own conversation. If a Customer enables the optional consent banner, the widget shows a short notice
        the first time it opens — this is a courtesy notice the Customer configures, not a substitute for whatever
        cookie-consent tooling the Customer&apos;s own website already uses.
      </p>

      <h2>7. Security</h2>
      <p>
        Data is stored with row-level access controls scoped per organization, service-role credentials are never exposed to
        the browser, and origin allowlisting restricts which websites can embed a given bot. No method of transmission or
        storage is 100% secure, but we design around the principle that one Customer&apos;s data should never be reachable by
        another.
      </p>

      <h2>8. Your rights</h2>
      <p>
        Depending on where you live, you may have the right to access, correct, export, or delete personal data we hold about
        you. Customers can reach us at <strong>[SUPPORT EMAIL]</strong> (or <strong>[DPO CONTACT]</strong> for data protection
        officer inquiries). A Visitor asking about a specific conversation should generally start with the business they
        chatted with, since that business configured and controls that bot — we&apos;ll assist them in fulfilling a verified
        request either way.
      </p>

      <h2>9. Children</h2>
      <p>VeloBot isn&apos;t directed at children, and Customers shouldn&apos;t knowingly deploy a bot to collect personal data from children without appropriate consent under applicable law.</p>

      <h2>10. International transfers</h2>
      <p>Data may be processed in countries other than your own, using our sub-processors&apos; own safeguards for international transfers.</p>

      <h2>11. Changes to this policy</h2>
      <p>We&apos;ll update the date at the top of this page and notify account admins by email for material changes.</p>

      <h2>12. Contact</h2>
      <p>
        <strong>[YOUR COMPANY LEGAL NAME]</strong>, <strong>[ADDRESS]</strong> — <strong>[SUPPORT EMAIL]</strong>.
      </p>
    </LegalPageShell>
  );
}
