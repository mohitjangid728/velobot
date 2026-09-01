import { NextResponse, type NextRequest } from "next/server";
import { CreateWorkflowRuleSchema } from "@velobot/shared";
import { requireBotAccess } from "@/lib/auth/bot-guard";
import { listWorkflowRules, createWorkflowRule } from "@/lib/workflow/workflow-manager";

export async function GET(_req: NextRequest, { params }: { params: { botId: string } }) {
  const guard = await requireBotAccess(params.botId, "admin");
  if (!guard.ok) return guard.response;

  const rules = await listWorkflowRules(params.botId);
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest, { params }: { params: { botId: string } }) {
  const guard = await requireBotAccess(params.botId, "admin");
  if (!guard.ok) return guard.response;

  const parsed = CreateWorkflowRuleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const rule = await createWorkflowRule(params.botId, parsed.data);
    return NextResponse.json({ rule });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create workflow rule" }, { status: 400 });
  }
}
