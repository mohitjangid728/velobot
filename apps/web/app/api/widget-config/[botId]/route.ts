import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { corsHeaders, isOriginAllowed } from "@/lib/security/origin";
import { anyAgentsOnline } from "@/lib/presence";
import { isOrgSuspended } from "@/lib/organizations";
import { isWithinBusinessHours } from "@/lib/bots/business-hours";
import { assertHasCapability } from "@/lib/billing/guards";
import type { BusinessHours } from "@velobot/shared";

/**
 * Public, unauthenticated endpoint the widget calls on load to fetch
 * theming/branding. Origin-gated by allowed_domains like every other
 * widget-facing route — an embed on a non-whitelisted domain fails to even
 * fetch its config, rather than partially loading and only failing once it
 * tries to send a message.
 */
export async function GET(req: NextRequest, { params }: { params: { botId: string } }) {
  const admin = createSupabaseAdminClient();
  const { data: bot } = await admin
    .from("bots")
    .select(
      "id, org_id, name, welcome_message, avatar_url, theme_color, launcher_icon_url, fallback_email_enabled, allowed_domains, branding_removed, business_hours, consent_banner_enabled, consent_banner_text, default_locale"
    )
    .eq("id", params.botId)
    .maybeSingle();

  if (!bot) {
    // No bot to check a whitelist against — permissive so a mistyped bot
    // id surfaces a real "not found" error instead of an opaque CORS
    // failure in devtools.
    return NextResponse.json({ error: "Bot not found" }, { status: 404, headers: corsHeaders(req, true) });
  }

  const allowed = isOriginAllowed(bot, req);
  const headers = corsHeaders(req, allowed);

  if (!allowed) {
    return NextResponse.json({ error: "Origin not allowed for this bot" }, { status: 403, headers });
  }

  if (await isOrgSuspended(bot.org_id)) {
    // Widget's bootstrap() logs and silently doesn't mount on a non-2xx —
    // the effect is the embed simply disappears from the suspended
    // customer's site, no new client-side state needed.
    return NextResponse.json({ error: "This bot is currently unavailable." }, { status: 403, headers });
  }

  const agentsOnline = await anyAgentsOnline(bot.org_id);
  // Re-checked here (not just at toggle time) so a bot that had the toggle
  // on before the org downgraded off Business stops hiding the footer
  // immediately, rather than the stale `true` bit persisting until an
  // admin happens to revisit Settings.
  const brandingCapability = await assertHasCapability(bot.org_id, "removeBranding");

  return NextResponse.json(
    {
      id: bot.id,
      name: bot.name,
      welcomeMessage: bot.welcome_message,
      avatarUrl: bot.avatar_url,
      themeColor: bot.theme_color,
      launcherIconUrl: bot.launcher_icon_url,
      fallbackEmailEnabled: bot.fallback_email_enabled,
      agentsOnline,
      // `?? default`s guard against a bot row fetched before migration 009
      // has been applied, where these columns don't exist yet.
      hideBranding: (bot.branding_removed ?? false) && brandingCapability.allowed,
      withinBusinessHours: isWithinBusinessHours((bot.business_hours as BusinessHours | null) ?? null),
      consentBannerEnabled: bot.consent_banner_enabled ?? false,
      consentBannerText: bot.consent_banner_text ?? null,
      locale: bot.default_locale ?? "en",
    },
    { headers }
  );
}

export async function OPTIONS(req: NextRequest) {
  // No body on a preflight request — can't look up the bot yet, so this
  // stays permissive. See the corsHeaders() doc comment.
  return new NextResponse(null, { status: 204, headers: corsHeaders(req, true) });
}
