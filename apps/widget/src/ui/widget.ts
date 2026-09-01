import styles from "../styles.css?inline";
import { ICONS } from "./icons";
import { createTranslator, resolveLocale } from "../i18n";
import type { WidgetConfig } from "../types";

export interface WidgetElements {
  shadowRoot: ShadowRoot;
  launcherButton: HTMLButtonElement;
  panel: HTMLDivElement;
  messagesContainer: HTMLDivElement;
  input: HTMLTextAreaElement;
  sendButton: HTMLButtonElement;
  attachButton: HTMLButtonElement;
  attachInput: HTMLInputElement;
  talkToHumanButton: HTMLButtonElement;
  /** The button's text node only — update this, not the button itself, so its icon survives label changes. */
  talkToHumanLabel: HTMLSpanElement;
  banner: HTMLDivElement;
  /** Business-hours "we're closed" notice — a separate element from `banner` (queued/assigned state) since the two can be true at once and shouldn't fight over one slot. */
  offlineBanner: HTMLDivElement;
  consentBanner: HTMLDivElement;
  consentDismissButton: HTMLButtonElement;
  offlineForm: HTMLFormElement;
  /** Its text is set dynamically (no-agents-online vs. outside-business-hours) by chat.ts before revealing the form — see handleTalkToHuman. */
  offlineNote: HTMLParagraphElement;
  offlineEmailInput: HTMLInputElement;
  offlineMessageInput: HTMLTextAreaElement;
  csatForm: HTMLFormElement;
  csatStars: HTMLButtonElement[];
  csatComment: HTMLTextAreaElement;
  unreadBadge: HTMLSpanElement;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, html?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

/** Darkens a `#rrggbb` hex color by `amount` (0-255) per channel — used to build a subtle two-tone header gradient from the bot's single configured theme color. Falls back to the input unchanged if it's not a plain 6-digit hex. */
function darken(hex: string, amount: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return hex;
  const num = parseInt(match[1], 16);
  const channel = (shift: number) => Math.max(0, ((num >> shift) & 0xff) - amount);
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

/**
 * Builds the whole widget DOM inside a Shadow DOM root attached to a host
 * div appended to <body>. Nothing here can leak host-page CSS in, or bleed
 * widget CSS out — the isolation boundary required by Module 3.
 */
export function mountWidget(config: WidgetConfig): WidgetElements {
  const t = createTranslator(resolveLocale(config.locale));

  const host = document.createElement("div");
  host.id = "velobot-widget-host";
  host.style.all = "initial";
  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: "open" });

  const styleTag = document.createElement("style");
  styleTag.textContent = styles;
  shadowRoot.appendChild(styleTag);

  const root = el("div", "vb-root");
  root.style.setProperty("--vb-primary", config.themeColor);
  shadowRoot.appendChild(root);

  // ── Launcher ─────────────────────────────────────────────────────────
  const launcherButton = el(
    "button",
    "vb-fixed vb-bottom-5 vb-right-5 vb-z-[2147483000] vb-flex vb-h-14 vb-w-14 vb-items-center vb-justify-center vb-rounded-full vb-text-white vb-transition-all vb-duration-200 hover:vb-scale-105 vb-animate-vb-launcher-in"
  ) as HTMLButtonElement;
  launcherButton.style.backgroundColor = config.themeColor;
  launcherButton.style.boxShadow = `0 10px 25px -5px ${config.themeColor}66, 0 8px 10px -6px ${config.themeColor}4d`;
  launcherButton.style.position = "fixed";
  launcherButton.setAttribute("aria-label", t("openChat"));

  const launcherIcon = el("span", "vb-flex vb-items-center vb-justify-center vb-transition-transform vb-duration-200");
  function renderLauncherIcon(open: boolean) {
    if (open) {
      launcherIcon.innerHTML = ICONS.close;
    } else if (config.launcherIconUrl) {
      launcherIcon.innerHTML = "";
      const img = el("img", "vb-h-7 vb-w-7 vb-rounded-full vb-object-cover") as HTMLImageElement;
      img.src = config.launcherIconUrl;
      launcherIcon.appendChild(img);
    } else {
      launcherIcon.innerHTML = ICONS.chat;
    }
  }
  renderLauncherIcon(false);

  const unreadBadge = el(
    "span",
    "vb-absolute vb--top-1 vb--right-1 vb-hidden vb-h-5 vb-min-w-[20px] vb-items-center vb-justify-center vb-rounded-full vb-border-2 vb-border-white vb-bg-red-500 vb-px-1 vb-text-[10px] vb-font-bold vb-text-white"
  ) as HTMLSpanElement;
  launcherButton.append(launcherIcon, unreadBadge);

  // ── Panel ────────────────────────────────────────────────────────────
  const panel = el(
    "div",
    "vb-fixed vb-bottom-24 vb-right-5 vb-z-[2147483000] vb-hidden vb-h-[600px] vb-max-h-[80vh] vb-w-[380px] vb-max-w-[92vw] vb-flex-col vb-overflow-hidden vb-rounded-3xl vb-bg-white vb-shadow-2xl vb-ring-1 vb-ring-black/5 vb-animate-vb-panel-in"
  ) as HTMLDivElement;

  const header = el(
    "div",
    "vb-relative vb-flex vb-shrink-0 vb-items-center vb-gap-3 vb-px-4 vb-py-3.5 vb-text-white vb-shadow-sm"
  );
  header.style.background = `linear-gradient(135deg, ${config.themeColor}, ${darken(config.themeColor, 30)})`;

  const avatarWrap = el("div", "vb-relative vb-shrink-0");
  const avatar = config.avatarUrl
    ? (el("img", "vb-h-10 vb-w-10 vb-rounded-full vb-object-cover vb-ring-2 vb-ring-white/40") as HTMLImageElement)
    : el("div", "vb-flex vb-h-10 vb-w-10 vb-items-center vb-justify-center vb-rounded-full vb-bg-white/20 vb-ring-2 vb-ring-white/40", ICONS.bot);
  if (config.avatarUrl) (avatar as HTMLImageElement).src = config.avatarUrl;
  avatarWrap.appendChild(avatar);
  if (config.agentsOnline) {
    const onlineDot = el(
      "span",
      "vb-absolute vb--bottom-0.5 vb--right-0.5 vb-h-3 vb-w-3 vb-rounded-full vb-border-2 vb-border-[color:var(--vb-primary)] vb-bg-emerald-400"
    );
    avatarWrap.appendChild(onlineDot);
  }

  const titleBlock = el("div", "vb-flex vb-min-w-0 vb-flex-1 vb-flex-col vb-gap-0.5");
  const title = el("div", "vb-truncate vb-text-[14px] vb-font-semibold vb-leading-tight", config.name);
  const status = el(
    "div",
    "vb-flex vb-items-center vb-gap-1 vb-truncate vb-text-[11px] vb-text-white/75",
    config.agentsOnline ? t("onlineNow") : t("repliesWithinMinutes")
  );
  titleBlock.append(title, status);

  const closeButton = el(
    "button",
    "vb-flex vb-h-7 vb-w-7 vb-shrink-0 vb-items-center vb-justify-center vb-rounded-full vb-text-white/80 vb-transition-colors hover:vb-bg-white/15 hover:vb-text-white",
    ICONS.close
  ) as HTMLButtonElement;
  closeButton.setAttribute("aria-label", t("closeChat"));
  header.append(avatarWrap, titleBlock, closeButton);

  const banner = el(
    "div",
    "vb-hidden vb-shrink-0 vb-bg-amber-50 vb-px-4 vb-py-2 vb-text-center vb-text-xs vb-font-medium vb-text-amber-800"
  ) as HTMLDivElement;

  const offlineBanner = el(
    "div",
    `vb-shrink-0 vb-bg-slate-100 vb-px-4 vb-py-2 vb-text-center vb-text-xs vb-font-medium vb-text-slate-600 ${config.withinBusinessHours ? "vb-hidden" : ""}`,
    t("outsideBusinessHoursBanner")
  ) as HTMLDivElement;

  const consentBanner = el(
    "div",
    `vb-hidden vb-shrink-0 vb-items-center vb-justify-between vb-gap-2 vb-border-b vb-border-slate-100 vb-bg-slate-50 vb-px-4 vb-py-2 vb-text-[11px] vb-text-slate-600`
  ) as HTMLDivElement;
  const consentText = el("span", undefined, config.consentBannerText || t("consentDefaultText"));
  const consentDismissButton = el(
    "button",
    "vb-shrink-0 vb-whitespace-nowrap vb-rounded-full vb-border vb-border-slate-300 vb-px-2.5 vb-py-1 vb-font-medium vb-text-slate-600 vb-transition-colors hover:vb-bg-slate-100",
    t("consentDismiss")
  ) as HTMLButtonElement;
  consentBanner.append(consentText, consentDismissButton);

  const messagesContainer = el(
    "div",
    "vb-flex vb-flex-1 vb-flex-col vb-gap-3 vb-overflow-y-auto vb-bg-slate-50/50 vb-px-4 vb-py-4"
  ) as HTMLDivElement;

  const footer = el("div", "vb-flex vb-shrink-0 vb-flex-col vb-gap-2 vb-border-t vb-border-slate-100 vb-bg-white vb-p-3");

  const talkToHumanButton = el(
    "button",
    "vb-flex vb-w-fit vb-items-center vb-gap-1.5 vb-self-start vb-rounded-full vb-border vb-border-slate-200 vb-px-2.5 vb-py-1 vb-text-[11px] vb-font-medium vb-text-slate-500 vb-transition-colors hover:vb-border-slate-300 hover:vb-bg-slate-50 disabled:vb-cursor-not-allowed disabled:vb-opacity-60 disabled:hover:vb-border-slate-200 disabled:hover:vb-bg-transparent"
  ) as HTMLButtonElement;
  const talkToHumanIcon = el("span", "vb-flex vb-h-3 vb-w-3 vb-shrink-0 [&>svg]:vb-h-3 [&>svg]:vb-w-3", ICONS.user);
  const talkToHumanLabel = el("span", undefined, t("talkToHuman")) as HTMLSpanElement;
  talkToHumanButton.append(talkToHumanIcon, talkToHumanLabel);

  const inputRow = el("div", "vb-flex vb-items-end vb-gap-2");
  const input = el(
    "textarea",
    "vb-max-h-24 vb-flex-1 vb-resize-none vb-overflow-hidden vb-rounded-2xl vb-border vb-border-slate-200 vb-bg-slate-50 vb-px-3.5 vb-py-2.5 vb-text-[13px] vb-text-slate-800 vb-outline-none vb-transition-all placeholder:vb-text-slate-400 focus:vb-border-[color:var(--vb-primary)] focus:vb-bg-white focus:vb-ring-2 focus:vb-ring-[color:var(--vb-primary)]/15"
  ) as HTMLTextAreaElement;
  input.placeholder = t("typeMessage");
  input.rows = 1;

  const attachInput = el("input", "vb-hidden") as HTMLInputElement;
  attachInput.type = "file";
  attachInput.accept = "image/png,image/jpeg,image/gif,image/webp,application/pdf";
  const attachButton = el(
    "button",
    "vb-flex vb-h-9 vb-w-9 vb-shrink-0 vb-items-center vb-justify-center vb-rounded-full vb-text-slate-400 vb-transition-colors hover:vb-bg-slate-100 hover:vb-text-slate-600",
    ICONS.attach
  ) as HTMLButtonElement;
  attachButton.type = "button";
  attachButton.setAttribute("aria-label", t("attachFile"));
  attachButton.addEventListener("click", () => attachInput.click());

  const sendButton = el(
    "button",
    "vb-flex vb-h-9 vb-w-9 vb-shrink-0 vb-items-center vb-justify-center vb-rounded-full vb-text-white vb-shadow-sm vb-transition-all hover:vb-brightness-110 active:vb-scale-95 disabled:vb-cursor-not-allowed disabled:vb-opacity-40 disabled:hover:vb-brightness-100",
    ICONS.send
  ) as HTMLButtonElement;
  sendButton.style.backgroundColor = config.themeColor;
  inputRow.append(attachButton, attachInput, input, sendButton);

  const brandFooter = el(
    "div",
    "vb-flex vb-items-center vb-justify-center vb-gap-1 vb-pt-0.5 vb-text-center vb-text-[10px] vb-text-slate-300"
  );
  const brandIcon = el("span", "vb-flex vb-h-2.5 vb-w-2.5 [&>svg]:vb-h-2.5 [&>svg]:vb-w-2.5", ICONS.bot);
  const brandLabel = el("span", undefined, t("poweredBy"));
  brandFooter.append(brandIcon, brandLabel);

  footer.append(talkToHumanButton, inputRow, ...(config.hideBranding ? [] : [brandFooter]));

  // ── Offline email-capture form (hidden until needed) ────────────────
  const offlineForm = el("form", "vb-hidden vb-flex-col vb-gap-2 vb-border-t vb-border-slate-100 vb-bg-white vb-p-3") as HTMLFormElement;
  const offlineNote = el("p", "vb-text-xs vb-text-slate-500", t("offlineNote")) as HTMLParagraphElement;
  const offlineEmailInput = el(
    "input",
    "vb-rounded-xl vb-border vb-border-slate-200 vb-bg-slate-50 vb-px-3.5 vb-py-2.5 vb-text-[13px] vb-outline-none vb-transition-all placeholder:vb-text-slate-400 focus:vb-border-[color:var(--vb-primary)] focus:vb-bg-white focus:vb-ring-2 focus:vb-ring-[color:var(--vb-primary)]/15"
  ) as HTMLInputElement;
  offlineEmailInput.type = "email";
  offlineEmailInput.placeholder = t("emailPlaceholder");
  offlineEmailInput.required = true;
  const offlineMessageInput = el(
    "textarea",
    "vb-resize-none vb-rounded-xl vb-border vb-border-slate-200 vb-bg-slate-50 vb-px-3.5 vb-py-2.5 vb-text-[13px] vb-outline-none vb-transition-all placeholder:vb-text-slate-400 focus:vb-border-[color:var(--vb-primary)] focus:vb-bg-white focus:vb-ring-2 focus:vb-ring-[color:var(--vb-primary)]/15"
  ) as HTMLTextAreaElement;
  offlineMessageInput.placeholder = t("whatCanWeHelp");
  offlineMessageInput.rows = 2;
  offlineMessageInput.required = true;
  const offlineSubmit = el(
    "button",
    "vb-self-end vb-rounded-full vb-px-4 vb-py-1.5 vb-text-[13px] vb-font-medium vb-text-white vb-shadow-sm vb-transition-all hover:vb-brightness-110 active:vb-scale-95",
    t("send")
  ) as HTMLButtonElement;
  offlineSubmit.type = "submit";
  offlineSubmit.style.backgroundColor = config.themeColor;
  offlineForm.append(offlineNote, offlineEmailInput, offlineMessageInput, offlineSubmit);

  // ── Post-resolve CSAT rating form (hidden until a conversation resolves) ──
  const csatForm = el("form", "vb-hidden vb-flex-col vb-gap-2 vb-border-t vb-border-slate-100 vb-bg-white vb-p-3") as HTMLFormElement;
  const csatPrompt = el("p", "vb-text-xs vb-font-medium vb-text-slate-600", t("csatPrompt"));
  const csatStarsRow = el("div", "vb-flex vb-items-center vb-gap-1");
  const csatStars: HTMLButtonElement[] = [];
  for (let i = 1; i <= 5; i++) {
    const star = el(
      "button",
      "vb-flex vb-h-7 vb-w-7 vb-items-center vb-justify-center vb-text-slate-300 vb-transition-colors hover:vb-text-amber-400 [&.vb-active]:vb-text-amber-400",
      ICONS.star
    ) as HTMLButtonElement;
    star.type = "button";
    star.dataset.score = String(i);
    star.setAttribute("aria-label", `${i} star${i === 1 ? "" : "s"}`);
    csatStars.push(star);
    csatStarsRow.appendChild(star);
  }
  const csatComment = el(
    "textarea",
    "vb-resize-none vb-rounded-xl vb-border vb-border-slate-200 vb-bg-slate-50 vb-px-3.5 vb-py-2.5 vb-text-[13px] vb-outline-none vb-transition-all placeholder:vb-text-slate-400 focus:vb-border-[color:var(--vb-primary)] focus:vb-bg-white focus:vb-ring-2 focus:vb-ring-[color:var(--vb-primary)]/15"
  ) as HTMLTextAreaElement;
  csatComment.placeholder = t("csatCommentPlaceholder");
  csatComment.rows = 2;
  const csatSubmit = el(
    "button",
    "vb-self-end vb-rounded-full vb-px-4 vb-py-1.5 vb-text-[13px] vb-font-medium vb-text-white vb-shadow-sm vb-transition-all hover:vb-brightness-110 active:vb-scale-95",
    t("csatSubmit")
  ) as HTMLButtonElement;
  csatSubmit.type = "submit";
  csatSubmit.style.backgroundColor = config.themeColor;
  csatForm.append(csatPrompt, csatStarsRow, csatComment, csatSubmit);

  panel.append(header, banner, offlineBanner, consentBanner, messagesContainer, footer, offlineForm, csatForm);

  root.append(panel, launcherButton);

  function setOpen(open: boolean) {
    panel.classList.toggle("vb-hidden", !open);
    panel.classList.toggle("vb-flex", open);
    renderLauncherIcon(open);
    launcherButton.setAttribute("aria-label", open ? "Close chat" : "Open chat");
    if (open) {
      unreadBadge.classList.add("vb-hidden");
      unreadBadge.classList.remove("vb-flex");
      input.focus();
    }
  }

  launcherButton.addEventListener("click", () => setOpen(panel.classList.contains("vb-hidden")));
  closeButton.addEventListener("click", () => setOpen(false));

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 96)}px`;
    // Only show the scrollbar once content genuinely exceeds the 96px cap —
    // otherwise a short message can trip a 1px textarea sizing rounding
    // quirk and show a hairline scrollbar track for no reason.
    input.style.overflowY = input.scrollHeight > 96 ? "auto" : "hidden";
  });

  return {
    shadowRoot,
    launcherButton,
    panel,
    messagesContainer,
    input,
    sendButton,
    attachButton,
    attachInput,
    talkToHumanButton,
    talkToHumanLabel,
    banner,
    offlineBanner,
    consentBanner,
    consentDismissButton,
    offlineForm,
    offlineNote,
    offlineEmailInput,
    offlineMessageInput,
    csatForm,
    csatStars,
    csatComment,
    unreadBadge,
  };
}

export function showBanner(banner: HTMLDivElement, text: string) {
  banner.textContent = text;
  banner.classList.remove("vb-hidden");
}

export function hideBanner(banner: HTMLDivElement) {
  banner.classList.add("vb-hidden");
}

export function bumpUnreadBadge(badge: HTMLSpanElement, panelOpen: boolean) {
  if (panelOpen) return;
  const current = parseInt(badge.textContent || "0", 10) || 0;
  badge.textContent = String(current + 1);
  badge.classList.remove("vb-hidden");
  badge.classList.add("vb-flex");
}
