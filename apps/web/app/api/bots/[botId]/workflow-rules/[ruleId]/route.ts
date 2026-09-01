import { NextResponse, type NextRequest } from "next/server";
import { UpdateWorkflowRuleSchema } from "@velobot/shared";
import { requireBotAccess } from "@/lib/auth/bot-guard";
import { updateWorkflowRule, deleteWorkflowRule } from "@/lib/workflow/workflow-manager";

export async function PATCH(req: NextRequest, { params }: { params: { botId: string; ruleId: string } }) {
  const guard = await requireBotAccess(params.botId, "admin");
  if (!guard.ok) return guard.response;

  const parsed = UpdateWorkflowRuleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const rule = await updateWorkflowRule(params.botId, params.ruleId, parsed.data);
    return NextResponse.json({ rule });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to update workflow rule" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { botId: string; ruleId: string } }) {
  const guard = await requireBotAccess(params.botId, "admin");
  if (!guard.ok) return guard.response;

  await deleteWorkflowRule(params.botId, params.ruleId);
  return NextResponse.json({ ok: true });
}
