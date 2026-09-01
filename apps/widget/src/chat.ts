import type { WidgetElements } from "./ui/widget";
import { showBanner, hideBanner, bumpUnreadBadge } from "./ui/widget";
import { renderBubble, renderTypingIndicator } from "./ui/render";
import { loadSession, saveSession } from "./state";
import { streamChat, escalateToHuman, captureOfflineMessage, fetchHistory, submitRating, uploadAttachment } from "./api";
import { subscribeToConversation, sendTypingSignal } from "./realtime";
import { createTranslator, resolveLocale, type Translator } from "./i18n";
import type { ChatMessage, ConversationMode, WidgetConfig, WidgetSession } from "./types";

const TYPING_RESEND_INTERVAL_MS = 2000;
const TYPING_STOP_DELAY_MS = 3000;

export class ChatController {
  private session: WidgetSession;
  private unsubscribeRealtime: (() => void) | null = null;
  private sending = false;
  private typingStopTimer: ReturnType<typeof setTimeout> | null = null;
  private lastTypingSentAt = 0;
  private t: Translator;
  private pendingAttachment: { url: string; type: string } | null = null;
  private csatScore = 0;

  constructor(
    private botId: string,
    private config: WidgetConfig,
    private elements: WidgetElements
  ) {
    this.session = loadSession(botId);
    this.t = createTranslator(resolveLocale(config.locale));
    this.bindEvents();
    this.initConsentBanner();
    void this.init();
  }

  private bindEvents() {
    const { sendButton, input, talkToHumanButton, offlineForm, csatForm, csatStars, attachInput, consentDismissButton } = this.elements;

    sendButton.addEventListener("click", () => this.handleSend());
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });
    input.addEventListener("input", () => this.handleTypingInput());
    talkToHumanButton.addEventListener("click", () => this.handleTalkToHuman());
    offlineForm.addEventListener("submit", (e) => this.handleOfflineSubmit(e));
    csatForm.addEventListener("submit", (e) => this.handleRatingSubmit(e));
    csatStars.forEach((star) => star.addEventListener("click", () => this.setCsatScore(Number(star.dataset.score))));
    attachInput.addEventListener("change", () => this.handleAttachmentSelected());
    consentDismissButton.addEventListener("click", () => this.dismissConsentBanner());
  }

  private initConsentBanner() {
    if (this.config.consentBannerEnabled && !this.session.consentAcknowledged) {
      this.elements.consentBanner.classList.remove("vb-hidden");
      this.elements.consentBanner.classList.add("vb-flex");
    }
  }

  private dismissConsentBanner() {
    this.elements.consentBanner.classList.add("vb-hidden");
    this.elements.consentBanner.classList.remove("vb-flex");
    this.session.consentAcknowledged = true;
    saveSession(this.botId, this.session);
  }

  private setCsatScore(score: number) {
    this.csatScore = score;
    this.elements.csatStars.forEach((star) => star.classList.toggle("vb-active", Number(star.dataset.score) <= score));
  }

  private async handleRatingSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (this.csatScore === 0) return;
    const comment = this.elements.csatComment.value.trim();
    try {
      await submitRating({ botId: this.botId, sessionId: this.session.sessionId, score: this.csatScore, comment: comment || null });
    } catch {
      // A failed rating submission isn't worth surfacing as an error bubble
      // to the visitor — it's a courtesy prompt, not a core chat function.
    }
    this.elements.csatForm.classList.add("vb-hidden");
    this.elements.csatForm.classList.remove("vb-flex");
    this.session.ratingSubmitted = true;
    saveSession(this.botId, this.session);
    this.appendMessage({ id: `sys-${Date.now()}`, role: "system", content: this.t("csatThanks") });
  }

  /**
   * Uploads immediately on file selection, then sends it as the next chat
   * turn — reusing handleSend's existing streaming/history/mode logic
   * rather than duplicating it, with the caption defaulting to the file
   * name if the visitor hadn't already typed one.
   */
  private async handleAttachmentSelected() {
    const file = this.elements.attachInput.files?.[0];
    this.elements.attachInput.value = "";
    if (!file) return;
    try {
      const { url, type } = await uploadAttachment({ botId: this.botId, sessionId: this.session.sessionId, file });
      this.pendingAttachment = { url, type };
      if (!this.elements.input.value.trim()) this.elements.input.value = file.name;
      void this.handleSend();
    } catch {
      this.appendMessage({ id: `err-${Date.now()}`, role: "system", content: this.t("uploadFailed") });
    }
  }

  /**
   * Broadcasts a "visitor is typing" signal to the agent inbox — only
   * meaningful once a human is actually on the conversation, since that's
   * the only time anyone's inbox is watching this conversation_id.
   * Throttled so every keystroke doesn't open a new broadcast round-trip,
   * and auto-clears after a pause so a closed tab doesn't leave a stuck
   * "typing..." indicator for the agent.
   */
  private handleTypingInput() {
    const conversationId = this.session.conversationId;
    if (!conversationId || (this.session.mode !== "queued" && this.session.mode !== "assigned")) return;

    const now = Date.now();
    if (now - this.lastTypingSentAt > TYPING_RESEND_INTERVAL_MS) {
      sendTypingSignal(conversationId, true);
      this.lastTypingSentAt = now;
    }

    if (this.typingStopTimer) clearTimeout(this.typingStopTimer);
    this.typingStopTimer = setTimeout(() => {
      sendTypingSignal(conversationId, false);
      this.lastTypingSentAt = 0;
    }, TYPING_STOP_DELAY_MS);
  }

  private stopTypingSignal() {
    if (this.typingStopTimer) {
      clearTimeout(this.typingStopTimer);
      this.typingStopTimer = null;
    }
    if (this.session.conversationId) sendTypingSignal(this.session.conversationId, false);
    this.lastTypingSentAt = 0;
  }

  private async init() {
    const welcome: ChatMessage = { id: "welcome", role: "assistant", content: this.config.welcomeMessage };

    if (!this.config.agentsOnline && this.config.fallbackEmailEnabled && this.session.mode === "ai") {
      // We don't force the offline form on load — only when the visitor
      // actually asks for a human and no one's there (see handleTalkToHuman).
    }

    const history = await fetchHistory(this.botId, this.session.sessionId);
    if (history.conversationId) {
      this.session.conversationId = history.conversationId;
      this.setMode(history.status as ConversationMode, { silent: true });
    }

    if (history.messages.length === 0) {
      this.appendMessage(welcome, { silent: true });
    } else {
      for (const m of history.messages) {
        if (m.role === "user" || m.role === "assistant" || m.role === "agent" || m.role === "system") {
          this.appendMessage(
            {
              id: m.id,
              role: m.role as ChatMessage["role"],
              content: m.content,
              attachmentUrl: m.attachment_url,
              attachmentType: m.attachment_type,
            },
            { silent: true }
          );
        }
      }
    }

    if (this.session.conversationId && (this.session.mode === "queued" || this.session.mode === "assigned")) {
      this.attachRealtime(this.session.conversationId);
    }
  }

  /** `silent: true` for replayed/initial history — only genuinely new, live messages should bump the unread badge. */
  private appendMessage(message: ChatMessage, opts: { silent?: boolean } = {}) {
    const bubble = renderBubble(message, this.config.themeColor, this.t("agentLabel"));
    this.elements.messagesContainer.appendChild(bubble);
    this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
    if (!opts.silent && this.elements.panel.classList.contains("vb-hidden") && message.role !== "user") {
      bumpUnreadBadge(this.elements.unreadBadge, false);
    }
  }

  private setMode(mode: ConversationMode, opts: { silent?: boolean } = {}) {
    this.session.mode = mode;
    saveSession(this.botId, this.session);

    if (mode === "queued") {
      showBanner(this.elements.banner, this.t("queuedBanner"));
    } else if (mode === "assigned") {
      showBanner(this.elements.banner, this.t("assignedBanner"));
    } else {
      hideBanner(this.elements.banner);
      if (!opts.silent) this.detachRealtime();
      // Fires on the silent replay at page load too (not just a live
      // transition) so a visitor who closed the tab before rating still
      // gets prompted next time — only session.ratingSubmitted, not
      // opts.silent, should ever suppress this.
      if (mode === "resolved" && !this.session.ratingSubmitted) this.showCsatPrompt();
    }

    this.updateTalkToHumanButton(mode);
  }

  private showCsatPrompt() {
    this.csatScore = 0;
    this.elements.csatStars.forEach((star) => star.classList.remove("vb-active"));
    this.elements.csatComment.value = "";
    this.elements.csatForm.classList.remove("vb-hidden");
    this.elements.csatForm.classList.add("vb-flex");
  }

  /**
   * The button only makes sense while the AI is handling things (or after a
   * chat resolves and it's fair game to ask again) — once a human is
   * already queued or connected, clicking it again would just re-fire
   * `/api/chat/escalate` on top of an escalation that already happened.
   */
  private updateTalkToHumanButton(mode: ConversationMode) {
    const { talkToHumanButton, talkToHumanLabel } = this.elements;
    if (mode === "queued") {
      talkToHumanButton.disabled = true;
      talkToHumanLabel.textContent = this.t("waitingForAgent");
    } else if (mode === "assigned") {
      talkToHumanButton.disabled = true;
      talkToHumanLabel.textContent = this.t("connectedToAgent");
    } else {
      talkToHumanButton.disabled = false;
      talkToHumanLabel.textContent = this.t("talkToHuman");
    }
  }

  private attachRealtime(conversationId: string) {
    this.detachRealtime();
    this.unsubscribeRealtime = subscribeToConversation(
      conversationId,
      (row) => {
        this.appendMessage({ id: row.id, role: row.role as ChatMessage["role"], content: row.content });
      },
      (status) => this.setMode(status as ConversationMode)
    );
  }

  private detachRealtime() {
    this.unsubscribeRealtime?.();
    this.unsubscribeRealtime = null;
  }

  private async handleSend() {
    const text = this.elements.input.value.trim();
    if (!text || this.sending) return;

    const attachment = this.pendingAttachment;
    this.pendingAttachment = null;

    this.stopTypingSignal();
    this.sending = true;
    this.elements.input.value = "";
    this.elements.input.style.height = "auto";
    this.elements.sendButton.disabled = true;

    const priorHistory = [...this.session.history];
    this.appendMessage({
      id: `local-${Date.now()}`,
      role: "user",
      content: text,
      attachmentUrl: attachment?.url,
      attachmentType: attachment?.type,
    });

    const isAiMode = this.session.mode === "ai";
    let typingIndicator: HTMLElement | null = null;
    if (isAiMode) {
      typingIndicator = renderTypingIndicator();
      this.elements.messagesContainer.appendChild(typingIndicator);
    }

    let assistantBubble: HTMLElement | null = null;
    let assistantText = "";

    try {
      for await (const evt of streamChat({
        botId: this.botId,
        sessionId: this.session.sessionId,
        message: text,
        history: priorHistory,
        attachmentUrl: attachment?.url,
        attachmentType: attachment?.type,
      })) {
        if (evt.event === "meta") {
          this.session.conversationId = evt.data.conversationId;
        } else if (evt.event === "human_mode") {
          typingIndicator?.remove();
          typingIndicator = null;
          this.setMode(evt.data.status);
          if (this.session.conversationId) this.attachRealtime(this.session.conversationId);
        } else if (evt.event === "token") {
          if (typingIndicator) {
            typingIndicator.remove();
            typingIndicator = null;
          }
          if (!assistantBubble) {
            assistantBubble = renderBubble({ id: `local-ai-${Date.now()}`, role: "assistant", content: "" }, this.config.themeColor);
            this.elements.messagesContainer.appendChild(assistantBubble);
          }
          assistantText += evt.data.token;
          const textNode = assistantBubble.firstElementChild;
          if (textNode) textNode.textContent = assistantText;
          this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
        } else if (evt.event === "done") {
          if (evt.data.fallback) this.showFallbackHint();
        } else if (evt.event === "error") {
          typingIndicator?.remove();
          this.appendMessage({ id: `err-${Date.now()}`, role: "system", content: evt.data.message });
        }
      }
    } finally {
      this.sending = false;
      this.elements.sendButton.disabled = false;
      typingIndicator?.remove();
    }

    if (isAiMode && assistantText) {
      this.session.history = [...priorHistory, { role: "user", content: text }, { role: "assistant", content: assistantText }];
      saveSession(this.botId, this.session);
    } else {
      this.session.history = [...priorHistory, { role: "user", content: text }];
      saveSession(this.botId, this.session);
    }
  }

  private showFallbackHint() {
    const hint = document.createElement("div");
    hint.className = "vb-px-1 vb-text-[11px] vb-text-slate-400";
    hint.textContent = this.t("fallbackHint");
    this.elements.messagesContainer.appendChild(hint);
  }

  private async handleTalkToHuman() {
    if (this.session.mode === "queued" || this.session.mode === "assigned") return;

    if (!this.config.agentsOnline || !this.config.withinBusinessHours) {
      this.elements.offlineNote.textContent = this.config.withinBusinessHours ? this.t("offlineNote") : this.t("offlineOutsideHoursNote");
      this.elements.offlineForm.classList.remove("vb-hidden");
      this.elements.offlineForm.classList.add("vb-flex");
      return;
    }

    try {
      const res = await escalateToHuman({ botId: this.botId, sessionId: this.session.sessionId });
      this.session.conversationId = res.conversationId;
      this.setMode("queued");
      this.attachRealtime(res.conversationId);
    } catch {
      this.appendMessage({ id: `err-${Date.now()}`, role: "system", content: this.t("agentUnreachable") });
    }
  }

  private async handleOfflineSubmit(e: SubmitEvent) {
    e.preventDefault();
    const email = this.elements.offlineEmailInput.value.trim();
    const message = this.elements.offlineMessageInput.value.trim();
    if (!email || !message) return;

    try {
      await captureOfflineMessage({ botId: this.botId, sessionId: this.session.sessionId, visitorEmail: email, message });
      this.elements.offlineForm.classList.add("vb-hidden");
      this.elements.offlineForm.classList.remove("vb-flex");
      this.appendMessage({ id: `local-${Date.now()}`, role: "user", content: message });
      this.appendMessage({
        id: `sys-${Date.now()}`,
        role: "system",
        content: this.t("offlineThanks", { email }),
      });
      this.setMode("queued");
    } catch {
      this.appendMessage({ id: `err-${Date.now()}`, role: "system", content: this.t("offlineSendFailed") });
    }
  }
}
