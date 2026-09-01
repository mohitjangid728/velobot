import "server-only";

export async function notifyDiscord(content: string, webhookUrl = process.env.DISCORD_ALERT_WEBHOOK_URL) {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  } catch (err) {
    console.error("[notifications] Discord webhook failed", err);
  }
}
