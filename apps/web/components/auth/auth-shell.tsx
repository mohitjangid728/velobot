import type { ReactNode } from "react";
import Link from "next/link";
import { Bot, MessageSquareText, ShieldCheck, Zap } from "lucide-react";

const FEATURES = [
  { icon: Zap, text: "AI trained only on your own content" },
  { icon: MessageSquareText, text: "One script tag to embed anywhere" },
  { icon: ShieldCheck, text: "Escalate to a human the moment it matters" },
];

function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={`flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground ${className ?? ""}`}
    >
      <Bot className="h-5 w-5" />
    </div>
  );
}

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Branded panel — hidden below lg, this is the "attractive" half */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[linear-gradient(135deg,#0A0D1C_0%,#12112E_45%,#1B1749_100%)] p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute -left-32 -top-40 h-[500px] w-[500px] rounded-full opacity-50"
          style={{ background: "radial-gradient(circle, #4F46E5 0%, rgba(79,70,229,0) 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-48 -right-32 h-[440px] w-[440px] rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, #818CF8 0%, rgba(129,140,248,0) 70%)" }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.09) 1.6px, transparent 1.6px)",
            backgroundSize: "32px 32px",
          }}
        />

        <Link href="/" className="relative z-10 flex items-center gap-2.5">
          <LogoMark />
          <span className="text-lg font-bold tracking-tight">VeloBot</span>
        </Link>

        <div className="relative z-10 flex flex-col gap-8">
          <h2 className="max-w-md text-3xl font-bold leading-tight tracking-tight">
            Answer customers instantly. Escalate to your team when it matters.
          </h2>
          <ul className="flex flex-col gap-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[15px] text-white/80">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10">
                  <Icon className="h-4 w-4 text-indigo-200" />
                </div>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-white/40">VeloBot — AI support platform</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-20">
        <Link href="/" className="mb-10 flex items-center gap-2.5 lg:hidden">
          <LogoMark />
          <span className="text-lg font-bold tracking-tight text-foreground">VeloBot</span>
        </Link>

        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
