import Link from "next/link";
import { Bot } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Bot className="h-4 w-4 text-primary" /> VeloBot
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-6">
          <Link href="/#features" className="transition-colors hover:text-foreground">
            Features
          </Link>
          <Link href="/pricing" className="transition-colors hover:text-foreground">
            Pricing
          </Link>
          <Link href="/login" className="transition-colors hover:text-foreground">
            Sign in
          </Link>
          <Link href="/signup" className="transition-colors hover:text-foreground">
            Get started
          </Link>
        </nav>
        <nav className="flex flex-wrap items-center justify-center gap-4 text-xs">
          <Link href="/legal/terms" className="transition-colors hover:text-foreground">
            Terms
          </Link>
          <Link href="/legal/privacy" className="transition-colors hover:text-foreground">
            Privacy
          </Link>
          <Link href="/legal/subprocessors" className="transition-colors hover:text-foreground">
            Sub-processors
          </Link>
        </nav>
        <p>&copy; {new Date().getFullYear()} VeloBot</p>
      </div>
    </footer>
  );
}
