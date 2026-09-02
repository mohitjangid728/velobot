"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";

/**
 * Landed on via the Supabase admin-invite magic link (see
 * app/api/orgs/[orgId]/invites/route.ts). The browser client picks up the
 * session from the URL hash automatically; this page just needs the user
 * to set a password, then it links them to the org via the invite token.
 */
export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptInviteForm />
    </Suspense>
  );
}

function AcceptInviteForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("Missing invite token.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();

    const { error: pwError } = await supabase.auth.updateUser({ password });
    if (pwError) {
      setLoading(false);
      setError(pwError.message);
      return;
    }

    const res = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not accept invite.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-sm text-muted-foreground">
        Verifying invite link...
      </main>
    );
  }

  return (
    <AuthShell title="Set your password" description="Finish joining your team's workspace.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loading} size="lg" className="mt-1">
          {loading ? "Joining..." : "Join workspace"}
        </Button>
      </form>
    </AuthShell>
  );
}
