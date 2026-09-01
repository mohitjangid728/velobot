import { ICONS } from "./icons";
import type { ChatMessage } from "../types";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  html?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

/** Escapes user/AI/agent content before it's ever placed via innerHTML elsewhere in the tree. */
export function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderAttachment(message: ChatMessage): HTMLElement | null {
  if (!message.attachmentUrl) return null;
  if (message.attachmentType?.startsWith("image/")) {
    const img = el("img", "vb-mt-1.5 vb-max-h-40 vb-max-w-full vb-rounded-lg vb-object-cover") as HTMLImageElement;
    img.src = message.attachmentUrl;
    img.alt = "Attachment";
    return img;
  }
  const link = el(
    "a",
    "vb-mt-1.5 vb-flex vb-w-fit vb-items-center vb-gap-1.5 vb-rounded-lg vb-bg-black/5 vb-px-2.5 vb-py-1.5 vb-text-[12px] vb-underline"
  ) as HTMLAnchorElement;
  link.href = message.attachmentUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "View attachment";
  return link;
}

export function renderBubble(message: ChatMessage, themeColor: string, agentLabelText = "Agent"): HTMLElement {
  if (message.role === "system") {
    const wrap = el(
      "div",
      "vb-my-1 vb-w-fit vb-max-w-[90%] vb-self-center vb-rounded-full vb-bg-slate-100 vb-px-3 vb-py-1 vb-text-center vb-text-[11px] vb-text-slate-500"
    );
    wrap.textContent = message.content;
    wrap.dataset.messageId = message.id;
    return wrap;
  }

  const isVisitor = message.role === "user";
  const row = el("div", `vb-flex vb-flex-col vb-gap-1 vb-animate-vb-fade-in ${isVisitor ? "vb-items-end" : "vb-items-start"}`);
  row.dataset.messageId = message.id;

  if (!isVisitor && message.role === "agent") {
    const label = el(
      "span",
      "vb-flex vb-items-center vb-gap-1 vb-px-1 vb-text-[10px] vb-font-medium vb-text-slate-400"
    );
    const icon = el("span", "vb-flex vb-h-2.5 vb-w-2.5 [&>svg]:vb-h-2.5 [&>svg]:vb-w-2.5", ICONS.user);
    label.append(icon, document.createTextNode(agentLabelText));
    row.appendChild(label);
  }

  const bubble = el(
    "div",
    `vb-max-w-[80%] vb-rounded-2xl vb-px-3.5 vb-py-2.5 vb-text-[13px] vb-leading-relaxed vb-whitespace-pre-wrap vb-break-words vb-shadow-sm ${
      isVisitor ? "vb-text-white vb-rounded-br-md" : "vb-bg-white vb-text-slate-800 vb-rounded-bl-md vb-ring-1 vb-ring-slate-100"
    }`
  );
  bubble.textContent = message.content;
  if (isVisitor) bubble.style.backgroundColor = themeColor;

  const attachment = renderAttachment(message);
  if (attachment) bubble.appendChild(attachment);

  row.appendChild(bubble);

  return row;
}

export function renderTypingIndicator(): HTMLElement {
  const wrap = el(
    "div",
    "vb-flex vb-w-fit vb-items-center vb-gap-1 vb-rounded-2xl vb-rounded-bl-md vb-bg-white vb-px-3.5 vb-py-3 vb-shadow-sm vb-ring-1 vb-ring-slate-100"
  );
  wrap.dataset.typingIndicator = "true";
  for (let i = 0; i < 3; i++) {
    const dot = el("span", "vb-h-1.5 vb-w-1.5 vb-rounded-full vb-bg-slate-400 vb-animate-pulse");
    dot.style.animationDelay = `${i * 150}ms`;
    wrap.appendChild(dot);
  }
  return wrap;
}
