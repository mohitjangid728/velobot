import "server-only";

export async function notifySlack(text: string, webhookUrl = process.env.SLACK_ALERT_WEBHOOK_URL) {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.error("[notifications] Slack webhook failed", err);
  }
}
