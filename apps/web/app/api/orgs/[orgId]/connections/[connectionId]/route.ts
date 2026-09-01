import { NextResponse, type NextRequest } from "next/server";
import { UpdateConnectionSchema, ROLE_RANK } from "@velobot/shared";
import { getCurrentUser, getRoleForOrg } from "@/lib/auth/session";
import { getConnection, updateConnection, deleteConnection } from "@/lib/connections/connections-manager";

async function requireAdmin(orgId: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const role = await getRoleForOrg(user.id, orgId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.admin) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, role };
}

// Unmasked — this is the edit-modal fetch, gated the same as every other admin-only dashboard read.
export async function GET(_req: NextRequest, { params }: { params: { orgId: string; connectionId: string } }) {
  const guard = await requireAdmin(params.orgId);
  if (!guard.ok) return guard.response;

  const connection = await getConnection(params.orgId, params.connectionId);
  if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  return NextResponse.json({ connection });
}

export async function PATCH(req: NextRequest, { params }: { params: { orgId: string; connectionId: string } }) {
  const guard = await requireAdmin(params.orgId);
  if (!guard.ok) return guard.response;

  const parsed = UpdateConnectionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const connection = await updateConnection(params.orgId, params.connectionId, parsed.data);
  return NextResponse.json({ connection });
}

export async function DELETE(_req: NextRequest, { params }: { params: { orgId: string; connectionId: string } }) {
  const guard = await requireAdmin(params.orgId);
  if (!guard.ok) return guard.response;
  await deleteConnection(params.orgId, params.connectionId);
  return NextResponse.json({ ok: true });
}
