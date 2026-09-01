import { NextResponse } from "next/server";
import { ACTIVE_ORG_COOKIE, IMPERSONATION_COOKIE } from "@/lib/auth/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(IMPERSONATION_COOKIE);
  res.cookies.delete(ACTIVE_ORG_COOKIE);
  return res;
}
