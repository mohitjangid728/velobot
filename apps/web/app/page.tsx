import Link from "next/link";
import { headers } from "next/headers";
import {
  Bot as BotIcon,
  MessageCircle,
  Send,
  Sparkles,
  MessagesSquare,
  Users,
  Zap,
  ShieldCheck,
  Code2,
  UsersRound,
  Globe,
  FileText,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PricingSection } from "@/components/marketing/pricing-section";
import { detectCurrency } from "@/lib/billing/currency";

const FEATURES = [
  {
    icon: MessagesSquare,
    title: "RAG-grounded answers",
    desc: "Crawl your site or upload PDFs, docs, and markdown. Your bot answers only from that content — never a hallucinated guess.",
  },
  {
    icon: Users,
    title: "Live agent handoff",
    desc: "One click escalates a conversation to your team's inbox with full context, ready for a human to take over instantly.",
  },
  {
    icon: Zap,
    title: "Bot Actions Engine",
    desc: "Let your bot capture leads, look up orders, or book demos by calling your own APIs — the AI asks for what it needs, then acts.",
  },
  {
    icon: ShieldCheck,
    title: "Any auth standard",
    desc: "API Key, Bearer, Basic, JWT, OAuth 2.0 with automatic token refresh, or OAuth 1.0a — connect to virtually any external system securely.",
  },
  {
    icon: Code2,
    title: "One script tag",
    desc: "Drop-in embeddable widget, Shadow DOM isolated so it never clashes with your site's styles, fully branded to match you.",
  },
  {
    icon: UsersRound,
    title: "Team & queues",
    desc: "Invite teammates with admin/agent roles, and route escalations to the right queue so the right people see them first.",
  },
];

const STEPS = [
  {
    icon: Globe,
    title: "Connect your content",
    desc: "Point it at your website or upload documents — we crawl, chunk, and embed everything automatically.",
  },
  {
    icon: MessageCircle,
    title: "Your bot answers instantly",
    desc: "Visitors get accurate, grounded answers 24/7, and the bot can trigger real actions when it has what it needs.",
  },
  {
    icon: Users,
    title: "Escalate to your team",
    desc: "The moment a conversation needs a human, it's queued straight to the right agents — nothing falls through the cracks.",
  },
];

const FAQS = [
  {
    q: "Will the bot make things up?",
    a: "No. It only answers from the content you've given it. If the answer isn't in your knowledge base, it says so plainly and can offer to connect the visitor with your team instead of guessing.",
  },
  {
    q: "Can it do more than just answer questions?",
    a: "Yes — the Bot Actions Engine lets it call your own APIs to capture leads, look up an order or ticket, or book a demo. It asks the visitor for whatever information it's missing before it acts.",
  },
  {
    q: "What happens when I hit my plan's limits?",
    a: "You'll see it coming on your billing page before it happens. If you do hit a limit, the bot degrades gracefully instead of breaking — you can upgrade or buy an add-on pack any time.",
  },
  {
    q: "Can my whole team use it?",
    a: "Yes — invite teammates as admins or agents, group them into queues, and route each bot's escalations to the right queue.",
  },
];

export default function MarketingHome() {
  const currency = detectCurrency(headers());

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
          />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
            <div className="flex flex-col gap-6">
              <span className="flex w-fit items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> AI support, trained on your content
              </span>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                Answer customers instantly.
                <br />
                <span className="text-primary">Escalate to your team</span> when it matters.
              </h1>
              <p className="max-w-lg text-lg text-muted-foreground">
                Embed one script tag and get an AI bot that answers only from your own content, takes real action
                through your APIs, and hands off to a live agent the moment a conversation needs a human touch.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/signup">
                    Get started free <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="#pricing">See pricing</Link>
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-status-good" /> Free plan, no card required
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-status-good" /> Live in minutes
                </span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-sm animate-float">
              <div className="absolute -left-6 top-64 z-10 hidden animate-in fade-in slide-in-from-left-4 fill-mode-both items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-medium shadow-lg [animation-delay:4400ms] xl:flex">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-status-good-bg text-status-good">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </span>
                Lead captured
              </div>
              <div className="absolute -right-6 bottom-20 z-10 hidden animate-in fade-in slide-in-from-right-4 fill-mode-both items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-medium shadow-lg [animation-delay:400ms] xl:flex">
                <Zap className="h-3.5 w-3.5 text-primary" />
                Replies in ~1s
              </div>

              <div className="flex flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl">
                <div className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                    <BotIcon className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold leading-none">Acme Support</span>
                    <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-primary-foreground/70">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-good opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-status-good" />
                      </span>
                      Online now
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-3 px-4 py-5">
                  <div className="max-w-[85%] animate-in fade-in slide-in-from-bottom-2 fill-mode-both rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-sm text-slate-800 [animation-delay:200ms]">
                    Hi! How can I help you today?
                  </div>
                  <div className="ml-auto max-w-[85%] animate-in fade-in slide-in-from-bottom-2 fill-mode-both rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground [animation-delay:1000ms]">
                    Do you offer a free trial?
                  </div>
                  <div className="max-w-[85%] animate-in fade-in slide-in-from-bottom-2 fill-mode-both rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-sm text-slate-800 [animation-delay:1900ms]">
                    Yes — every plan starts with a free tier, no card required. Want me to have someone reach out?
                  </div>
                  <div className="ml-auto max-w-[85%] animate-in fade-in slide-in-from-bottom-2 fill-mode-both rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground [animation-delay:2800ms]">
                    Sure — I&apos;m Jane, jane@acme.co
                  </div>
                  <div className="flex w-fit animate-in fade-in fill-mode-both items-center gap-1 rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2.5 [animation-delay:3600ms]">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                  </div>
                </div>
                <div className="flex items-center gap-2 border-t p-3">
                  <div className="flex-1 rounded-xl border bg-white px-3 py-2 text-sm text-muted-foreground">
                    Type your message...
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Send className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────────────── */}
        <section id="features" className="border-t bg-muted/30">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                Features
              </span>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything a support team needs</h2>
              <p className="text-muted-foreground">
                Not just a chatbot — a full platform for AI-assisted support, from first message to resolution.
              </p>
            </div>

            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-subtle transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-24">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              How it works
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Live in three steps</h2>
          </div>

          <div className="mt-14 grid gap-8 sm:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="relative flex flex-col items-center gap-3 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Step {i + 1}
                </span>
                <h3 className="font-semibold">{title}</h3>
                <p className="max-w-xs text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Pricing ──────────────────────────────────────────────────── */}
        <div id="pricing" className="border-t bg-muted/30">
          <PricingSection currency={currency} />
        </div>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-3xl px-6 py-24">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              FAQ
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Common questions</h2>
          </div>
          <div className="mt-10 flex flex-col divide-y rounded-xl border bg-card">
            {FAQS.map(({ q, a }) => (
              <div key={q} className="flex flex-col gap-2 p-6">
                <h3 className="flex items-center gap-2 font-semibold">
                  <FileText className="h-4 w-4 shrink-0 text-primary" /> {q}
                </h3>
                <p className="text-sm text-muted-foreground">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────── */}
        <section className="border-t bg-primary">
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 py-20 text-center text-primary-foreground">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to put your support on autopilot?</h2>
            <p className="max-w-lg text-primary-foreground/80">
              Start free, embed one script tag, and let your bot start answering — upgrade only when you need more.
            </p>
            <Button asChild size="lg" variant="secondary">
              <Link href="/signup">
                Get started free <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
