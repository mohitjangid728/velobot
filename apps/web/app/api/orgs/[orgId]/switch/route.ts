import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, getRoleForOrg, ACTIVE_ORG_COOKIE } from "@/lib/auth/session";

export async function POST(req: NextRequest, { params }: { params: { orgId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getRoleForOrg(user.id, params.orgId);
  if (!role) return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACTIVE_ORG_COOKIE, params.orgId, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
