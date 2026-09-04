"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";

// Seeded by apps/web/scripts/seed-test-accounts.mjs — keep these in sync
// with that script if you ever change them. Customer/Admin/Agent live in the
// "Demo Workspace" org and land wherever their role normally would (resolved
// dynamically below); Super Admin holds a platform_admins row and no org
// membership at all, so it needs an explicit override straight to /admin.
const TEST_ACCOUNTS = [
  { label: "Customer (Admin)", email: "customer@velobot.test", password: "TestPass123!", redirectTo: undefined },
  { label: "Admin", email: "admin@velobot.test", password: "TestPass123!", redirectTo: undefined },
  { label: "Agent", email: "agent@velobot.test", password: "TestPass123!", redirectTo: undefined },
  { label: "Super Admin", email: "superadmin@velobot.test", password: "TestPass123!", redirectTo: "/admin" },
] as const;

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Lands the user on the right screen in one hop — an agent goes straight
  // to /inbox, never through /dashboard first. `explicitRedirect` is only
  // for accounts whose destination can't be derived from org membership
  // (e.g. a Super Admin with no workspace at all).
  async function resolveDestination(explicitRedirect?: string): Promise<string> {
    const queryRedirect = params.get("redirect");
    if (queryRedirect) return queryRedirect;
    if (explicitRedirect) return explicitRedirect;
    try {
      const res = await fetch("/api/orgs");
      const body = await res.json();
      const memberships = (body.memberships ?? []) as { role: string }[];
      if (memberships.length === 0) return "/onboarding";
      return memberships[0]?.role === "agent" ? "/inbox" : "/dashboard";
    } catch {
      return "/dashboard";
    }
  }

  async function performSignIn(signInEmail: string, signInPassword: string, explicitRedirect?: string) {
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email: signInEmail, password: signInPassword });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    const destination = await resolveDestination(explicitRedirect);
    setLoading(false);
    // No router.refresh() here — this is always a navigation to a brand-new
    // route post-login, and refresh() right after push() was forcing a
    // second full RSC fetch of the destination on top of the one push()
    // already triggers (it's only needed when staying on the same route,
    // like OrgSwitcher does when switching workspace).
    router.push(destination);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await performSignIn(email, password);
  }

  return (
    <AuthShell
      title="Sign in"
      description="Welcome back to VeloBot."
      footer={
        <>
          No account?{" "}
          <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs font-medium text-primary underline-offset-4 hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loading} size="lg" className="mt-1">
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      {process.env.NODE_ENV !== "production" && (
        <div className="mt-8 rounded-xl border bg-muted/40 p-4">
          <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Test accounts (dev only)
          </p>
          <div className="flex flex-col gap-2">
            {TEST_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                disabled={loading}
                onClick={() => performSignIn(account.email, account.password, account.redirectTo)}
                className="flex flex-col rounded-lg border bg-card px-3 py-2 text-left text-xs shadow-subtle transition-all hover:-translate-y-0.5 hover:shadow-card-hover disabled:opacity-50"
              >
                <span className="font-medium text-foreground">{account.label}</span>
                <span className="text-muted-foreground">
                  {account.email} · {account.password}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Seeded via <code>apps/web/scripts/seed-test-accounts.mjs</code>
          </p>
        </div>
      )}
    </AuthShell>
  );
}
