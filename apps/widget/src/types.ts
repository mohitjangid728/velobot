export interface WidgetConfig {
  id: string;
  name: string;
  welcomeMessage: string;
  avatarUrl: string | null;
  themeColor: string;
  launcherIconUrl: string | null;
  fallbackEmailEnabled: boolean;
  agentsOnline: boolean;
  hideBranding: boolean;
  withinBusinessHours: boolean;
  consentBannerEnabled: boolean;
  consentBannerText: string | null;
  locale: string;
}

export type ChatRole = "user" | "assistant" | "agent" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
}

export type ConversationMode = "ai" | "queued" | "assigned" | "resolved" | "offline";

export interface WidgetSession {
  sessionId: string;
  conversationId: string | null;
  mode: ConversationMode;
  history: { role: "user" | "assistant"; content: string }[];
  /** Set once the visitor submits (or the widget decides not to re-prompt for) a post-resolve rating, so a reloaded tab doesn't ask again for the same conversation. */
  ratingSubmitted?: boolean;
  /** Set once the visitor dismisses the consent strip, so it doesn't reappear every time the panel reopens in the same session. */
  consentAcknowledged?: boolean;
}
