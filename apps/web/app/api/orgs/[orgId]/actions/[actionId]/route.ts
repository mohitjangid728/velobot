import { NextResponse, type NextRequest } from "next/server";
import { UpdateActionSchema, ROLE_RANK } from "@velobot/shared";
import { getCurrentUser, getRoleForOrg } from "@/lib/auth/session";
import { getAction, updateAction, deleteAction } from "@/lib/actions/actions-manager";

async function requireAdmin(orgId: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const role = await getRoleForOrg(user.id, orgId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.admin) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, role };
}

export async function GET(_req: NextRequest, { params }: { params: { orgId: string; actionId: string } }) {
  const guard = await requireAdmin(params.orgId);
  if (!guard.ok) return guard.response;

  const action = await getAction(params.orgId, params.actionId);
  if (!action) return NextResponse.json({ error: "Action not found" }, { status: 404 });
  return NextResponse.json({ action });
}

export async function PATCH(req: NextRequest, { params }: { params: { orgId: string; actionId: string } }) {
  const guard = await requireAdmin(params.orgId);
  if (!guard.ok) return guard.response;

  const parsed = UpdateActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const action = await updateAction(params.orgId, params.actionId, parsed.data);
    return NextResponse.json({ action });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to update action" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { orgId: string; actionId: string } }) {
  const guard = await requireAdmin(params.orgId);
  if (!guard.ok) return guard.response;

  await deleteAction(params.orgId, params.actionId);
  return NextResponse.json({ ok: true });
}
