import { fetchWidgetConfig } from "./api";
import { mountWidget } from "./ui/widget";
import { ChatController } from "./chat";

function getBotId(): string | null {
  const current = document.currentScript as HTMLScriptElement | null;
  if (current?.dataset.botId) return current.dataset.botId;
  // Fallback for cases where currentScript isn't reliable (e.g. dynamically
  // injected via a tag manager) — find the widget's own script tag by src.
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>("script[data-bot-id]"));
  return scripts[scripts.length - 1]?.dataset.botId ?? null;
}

async function bootstrap() {
  const botId = getBotId();
  if (!botId) {
    console.error("[velobot] Missing data-bot-id on the widget <script> tag.");
    return;
  }

  try {
    const config = await fetchWidgetConfig(botId);
    const elements = mountWidget(config);
    new ChatController(botId, config, elements);
  } catch (err) {
    console.error("[velobot] Failed to initialize widget:", err);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  void bootstrap();
}
