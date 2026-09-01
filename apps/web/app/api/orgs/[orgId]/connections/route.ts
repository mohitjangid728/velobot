import { NextResponse, type NextRequest } from "next/server";
import { CreateConnectionSchema, ROLE_RANK } from "@velobot/shared";
import { getCurrentUser, getRoleForOrg } from "@/lib/auth/session";
import { listConnections, createConnection, maskConnectionHeaders } from "@/lib/connections/connections-manager";

export async function GET(_req: NextRequest, { params }: { params: { orgId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getRoleForOrg(user.id, params.orgId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const connections = await listConnections(params.orgId);
  return NextResponse.json({ connections: connections.map(maskConnectionHeaders) });
}

export async function POST(req: NextRequest, { params }: { params: { orgId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getRoleForOrg(user.id, params.orgId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = CreateConnectionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const connection = await createConnection(params.orgId, parsed.data);
  return NextResponse.json({ connection });
}
