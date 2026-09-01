import { NextResponse, type NextRequest } from "next/server";
import { ROLE_RANK } from "@velobot/shared";
import { getCurrentUser, getRoleForOrg } from "@/lib/auth/session";
import { listConnectionLogs } from "@/lib/connections/connections-manager";

export async function GET(req: NextRequest, { params }: { params: { orgId: string; connectionId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getRoleForOrg(user.id, params.orgId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const cursor = req.nextUrl.searchParams.get("cursor");
  const page = await listConnectionLogs(params.connectionId, cursor);
  return NextResponse.json(page);
}
