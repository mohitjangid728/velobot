"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";

type Status = "checking" | "ready" | "invalid" | "done";

/**
 * Lands here from the recovery email's link, whose redirect carries the
 * session as a URL hash fragment (#access_token=...&refresh_token=...) —
 * generateLink() (app/api/auth/forgot-password/route.ts) always produces
 * this implicit-flow shape regardless of the browser client's own
 * flowType. Since this app's client is configured for flowType: "pkce"
 * (see lib/supabase/client.ts, via @supabase/ssr's default), its built-in
 * detectSessionInUrl only watches for a PKCE `?code=` param and never
 * picks up a hash fragment automatically — so this reads it manually and
 * calls setSession() itself rather than trusting auto-detection to fire.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (access_token && refresh_token) {
      supabase.auth.setSession({ access_token, refresh_token }).then(({ data }) => {
        window.history.replaceState(null, "", window.location.pathname);
        setStatus(data.session ? "ready" : "invalid");
      });
      return;
    }
    // No token in the URL — maybe a session already exists from a prior
    // load of this same link (e.g. the user refreshed the page).
    supabase.auth.getSession().then(({ data }) => setStatus(data.session ? "ready" : "invalid"));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStatus("done");
    setTimeout(() => router.push("/login"), 2000);
  }

  return (
    <AuthShell title="Set a new password" description="Choose a new password for your VeloBot account.">
      {status === "checking" && <p className="text-sm text-muted-foreground">Verifying your reset link...</p>}
      {status === "invalid" && (
        <p className="text-sm text-status-critical">
          This reset link is invalid or has expired. Request a new one from the{" "}
          <a href="/forgot-password" className="font-medium underline underline-offset-4">
            forgot password
          </a>{" "}
          page.
        </p>
      )}
      {status === "done" && <p className="text-sm text-status-good">Password updated — redirecting you to sign in...</p>}
      {status === "ready" && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading} size="lg" className="mt-1">
            {loading ? "Updating..." : "Update password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
