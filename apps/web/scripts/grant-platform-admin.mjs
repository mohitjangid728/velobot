// Bootstraps the first Super Admin — there's no UI path to do this (nothing
// can promote anyone until at least one platform_admins row exists), so
// this is the one-time chicken-and-egg breaker. Also usable afterwards for
// CLI-based promotion if you ever need it outside the /admin/admins UI.
//
// Usage (from apps/web):
//   node --env-file=.env.local scripts/grant-platform-admin.mjs someone@example.com
//
// Requires supabase/sql/002_platform_admin_and_queues.sql to have been run
// first (creates the platform_admins table), and the target email must
// already be a real Supabase Auth user (sign up normally first).

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Run with (from apps/web): node --env-file=.env.local scripts/grant-platform-admin.mjs <email>");
  process.exit(1);
}
if (!email) {
  console.error("Usage: node --env-file=.env.local scripts/grant-platform-admin.mjs <email>");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(targetEmail) {
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase());
    if (match) return match;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function main() {
  const user = await findUserByEmail(email);
  if (!user) {
    console.error(`No existing account for ${email} — they need to sign up first (Super Admin is never invite-by-email).`);
    process.exit(1);
  }

  const { error } = await supabase.from("platform_admins").upsert({ user_id: user.id }, { onConflict: "user_id" });
  if (error) throw error;

  console.log(`✓ ${email} is now a Super Admin. They can visit /admin after their next sign-in.`);
}

main().catch((err) => {
  console.error("Grant failed:", err.message ?? err);
  process.exit(1);
});
