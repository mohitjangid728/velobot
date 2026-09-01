import { AlertTriangle } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export function LegalPageShell({ title, updatedAt, children }: { title: string; updatedAt: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className="mb-6 flex items-start gap-2 rounded-lg border border-status-warning-bg bg-status-warning-bg/60 p-3 text-sm text-status-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <strong>Draft — pending legal review.</strong> This page is a complete first draft written to match what VeloBot
              actually does, with a few placeholders (marked in brackets) that need your company&apos;s real details. Have a
              lawyer review it before relying on it.
            </p>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Last updated {updatedAt}</p>
          <div className="prose-legal mt-8 flex flex-col gap-5 text-sm leading-relaxed text-foreground [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
            {children}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
