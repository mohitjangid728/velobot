import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendPasswordResetEmail } from "@/lib/notifications/password-reset-email";

const ForgotPasswordSchema = z.object({ email: z.string().email() });

/**
 * Always responds 200 with the same generic message regardless of whether
 * the email has an account — revealing that would let anyone enumerate
 * registered emails one guess at a time.
 */
export async function POST(req: NextRequest) {
  const parsed = ForgotPasswordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`;
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: parsed.data.email,
    options: { redirectTo },
  });
  const actionLink = data?.properties?.action_link;
  if (!error && actionLink) {
    await sendPasswordResetEmail(parsed.data.email, actionLink);
  }
  // Same response whether or not the account exists / the send succeeded.
  return NextResponse.json({ ok: true });
}
