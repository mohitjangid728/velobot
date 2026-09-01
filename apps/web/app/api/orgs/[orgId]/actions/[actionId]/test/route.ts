import { NextResponse, type NextRequest } from "next/server";
import { RunActionSchema, ROLE_RANK } from "@velobot/shared";
import { getCurrentUser, getRoleForOrg } from "@/lib/auth/session";
import { getAction } from "@/lib/actions/actions-manager";
import { getConnection } from "@/lib/connections/connections-manager";
import { executeAction } from "@/lib/actions/executeAction";

export async function POST(req: NextRequest, { params }: { params: { orgId: string; actionId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getRoleForOrg(user.id, params.orgId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = RunActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const action = await getAction(params.orgId, params.actionId);
  if (!action) return NextResponse.json({ error: "Action not found" }, { status: 404 });

  const connection = await getConnection(params.orgId, action.connection_id);
  if (!connection) return NextResponse.json({ error: "Linked connection not found" }, { status: 404 });

  const result = await executeAction({ action, connection, params: parsed.data.params, source: "test" });
  return NextResponse.json(result);
}
