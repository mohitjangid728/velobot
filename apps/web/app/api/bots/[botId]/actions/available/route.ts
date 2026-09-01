import { NextResponse, type NextRequest } from "next/server";
import { requireBotAccess } from "@/lib/auth/bot-guard";
import { getActiveToolsForBot } from "@/lib/actions/actions-manager";

/**
 * Agent-facing — deliberately separate from the admin CRUD routes above so
 * an "agent" role session can see *what's runnable* without ever touching
 * connection credentials.
 */
export async function GET(_req: NextRequest, { params }: { params: { botId: string } }) {
  const guard = await requireBotAccess(params.botId, "agent");
  if (!guard.ok) return guard.response;

  const active = await getActiveToolsForBot(params.botId);
  return NextResponse.json({
    actions: active.map(({ action }) => ({
      id: action.id,
      name: action.name,
      trigger_description: action.trigger_description,
      parameters: action.parameters,
    })),
  });
}
