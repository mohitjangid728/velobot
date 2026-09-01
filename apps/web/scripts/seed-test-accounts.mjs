// Dev-only seed script — creates Supabase Auth users and a shared demo
// workspace so the login page's quick-login buttons have real accounts to
// sign into. Safe to re-run (idempotent: looks up existing users/org by
// email/slug before creating). The Super Admin account is intentionally
// NOT a member of the demo workspace — see the SUPER_ADMIN comment below.
//
// Usage (from apps/web):
//   node --env-file=.env.local scripts/seed-test-accounts.mjs
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, which
// apps/web/.env.local already has.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Run with (from apps/web): node --env-file=.env.local scripts/seed-test-accounts.mjs");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "TestPass123!";
const DEMO_ORG_SLUG = "demo-workspace";
const ACCOUNTS = [
  { email: "customer@velobot.test", role: "admin", label: "Customer (Admin)" },
  { email: "admin@velobot.test", role: "admin", label: "Admin" },
  { email: "agent@velobot.test", role: "agent", label: "Agent" },
];

// Kept separate from ACCOUNTS/Demo Workspace on purpose — a Super Admin has
// platform-wide access independent of any org membership and should never
// belong to a workspace (see packages/shared/src/types/database.ts's
// PlatformAdmin doc comment).
const SUPER_ADMIN = { email: "superadmin@velobot.test", label: "Super Admin" };

async function findUserByEmail(email) {
  // supabase-js v2 has no direct "get by email" admin call — page through
  // listUsers. Fine for a small dev project.
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function upsertUser(email, password) {
  const existing = await findUserByEmail(email);
  if (existing) return existing;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user;
}

async function upsertDemoOrg() {
  const { data: existing } = await supabase
    .from("organizations")
    .select("*")
    .eq("slug", DEMO_ORG_SLUG)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase
    .from("organizations")
    .insert({ name: "Demo Workspace", slug: DEMO_ORG_SLUG, plan: "free", seats_limit: 5 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function main() {
  const org = await upsertDemoOrg();
  console.log(`Demo workspace: ${org.name} (${org.id})`);

  for (const account of ACCOUNTS) {
    const user = await upsertUser(account.email, PASSWORD);
    const { error } = await supabase
      .from("org_members")
      .upsert(
        { org_id: org.id, user_id: user.id, role: account.role, status: "active" },
        { onConflict: "org_id,user_id" }
      );
    if (error) throw error;
    console.log(`✓ ${account.label}: ${account.email} / ${PASSWORD}`);
  }

  const superAdminUser = await upsertUser(SUPER_ADMIN.email, PASSWORD);
  const { error: adminError } = await supabase
    .from("platform_admins")
    .upsert({ user_id: superAdminUser.id, granted_by: superAdminUser.id }, { onConflict: "user_id" });
  if (adminError) throw adminError;
  console.log(`✓ ${SUPER_ADMIN.label}: ${SUPER_ADMIN.email} / ${PASSWORD} (no workspace — platform_admins only)`);

  console.log("\nDone. These credentials are also shown on the login page in non-production builds.");
}

main().catch((err) => {
  console.error("Seed failed:", err.message ?? err);
  process.exit(1);
});
