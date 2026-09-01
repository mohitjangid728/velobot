import { LegalPageShell } from "@/components/marketing/legal-page-shell";

export const metadata = { title: "Sub-processors — VeloBot" };

const SUBPROCESSORS = [
  { name: "OpenAI", purpose: "Generates chat responses; powers the optional intent/sentiment/entity extraction feature.", location: "United States" },
  { name: "Supabase", purpose: "Primary database, authentication, file/attachment storage, and realtime messaging between the widget and agent inbox.", location: "United States" },
  { name: "Razorpay", purpose: "Billing and payment processing. Card and payment details are handled directly by Razorpay and never touch VeloBot's servers.", location: "India" },
  { name: "Resend", purpose: "Delivers transactional email (team invites, unassigned-conversation and offline-message notifications).", location: "United States" },
  { name: "Upstash", purpose: "Rate limiting for the chat widget and the Developer API.", location: "United States / global edge" },
  { name: "Sentry", purpose: "Error monitoring for the dashboard, inbox, and chat API — active only once an account admin configures it.", location: "United States" },
  { name: "PostHog", purpose: "Product analytics (e.g. signup and checkout funnel) — active only once an account admin configures it.", location: "United States / EU" },
];

export default function SubprocessorsPage() {
  return (
    <LegalPageShell title="Sub-processors" updatedAt="[DATE]">
      <p>
        These are the third-party services VeloBot uses to operate the platform, each processing data only as needed to
        provide their part of the service and bound by their own data-processing agreements. We&apos;ll update this list before
        adding a new sub-processor that would materially change how your data is handled.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Sub-processor</th>
              <th className="px-4 py-2.5 font-medium">Purpose</th>
              <th className="px-4 py-2.5 font-medium">Location</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {SUBPROCESSORS.map((s) => (
              <tr key={s.name}>
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.purpose}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>Questions about a specific sub-processor: <strong>[SUPPORT EMAIL]</strong>.</p>
    </LegalPageShell>
  );
}
