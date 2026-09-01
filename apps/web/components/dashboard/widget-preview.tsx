import { Bot as BotIcon, MessageCircle, Send, User, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WidgetPreviewConfig {
  name: string;
  welcomeMessage: string;
  themeColor: string;
  avatarUrl?: string;
  launcherIconUrl?: string;
}

/**
 * Mirrors apps/widget/src/ui/widget.ts's actual DOM/classes as closely as
 * a React component reasonably can — same panel size, header layout,
 * bubble shapes/colors, and footer — so this is a true preview of the
 * embedded widget, not a reinterpretation of it. Entirely static: no
 * message state, no handlers, inputs are `disabled`.
 */
export function WidgetPreview({ config }: { config: WidgetPreviewConfig }) {
  const { name, welcomeMessage, themeColor, avatarUrl, launcherIconUrl } = config;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">Live preview</p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          Preview only — not interactive
        </span>
      </div>

      {/* Mock page backdrop, so the widget reads as "embedded on your site" rather than floating in a vacuum. Capped well under typical viewport height so it never needs its own scroll. */}
      <div className="relative flex h-[520px] flex-col overflow-hidden rounded-xl border bg-slate-50">
        <div className="flex shrink-0 items-center gap-1.5 border-b bg-white px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          <span className="ml-2 h-5 flex-1 rounded bg-slate-100" />
        </div>

        {/* Chat panel — 380x600, matches the widget's real dimensions */}
        <div className="absolute bottom-20 right-4 flex h-[360px] w-[300px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex shrink-0 items-center gap-3 px-4 py-3 text-white" style={{ backgroundColor: themeColor }}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <BotIcon className="h-4 w-4" />
              </div>
            )}
            <div className="flex-1 truncate text-sm font-semibold">{name || "Your Bot"}</div>
            <X className="h-[18px] w-[18px] opacity-80" />
          </div>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
            <div className="flex flex-col items-start gap-1">
              <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-[13px] leading-relaxed text-slate-800">
                {welcomeMessage || "Hi! How can I help you today?"}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div
                className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm px-3 py-2 text-[13px] leading-relaxed text-white"
                style={{ backgroundColor: themeColor }}
              >
                Do you offer a free trial?
              </div>
            </div>
            <div className="flex flex-col items-start gap-1">
              <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-[13px] leading-relaxed text-slate-800">
                Yes — every plan starts with a 14-day free trial, no card required. Want me to walk you through getting
                started?
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 p-3">
            <button
              disabled
              className="w-fit cursor-not-allowed self-start rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-400"
            >
              Talk to a human
            </button>
            <div className="flex items-end gap-2">
              <textarea
                disabled
                rows={1}
                placeholder="Type your message..."
                className="max-h-24 flex-1 cursor-not-allowed resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-400 outline-none"
              />
              <button
                disabled
                className="flex h-9 w-9 shrink-0 cursor-not-allowed items-center justify-center rounded-full text-white opacity-40"
                style={{ backgroundColor: themeColor }}
              >
                <Send className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        </div>

        {/* Launcher bubble */}
        <button
          disabled
          className={cn(
            "absolute bottom-4 right-4 flex h-12 w-12 cursor-not-allowed items-center justify-center rounded-full text-white shadow-lg"
          )}
          style={{ backgroundColor: themeColor }}
        >
          {launcherIconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={launcherIconUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
          ) : (
            <MessageCircle className="h-6 w-6" />
          )}
        </button>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <User className="h-3 w-3" /> The two sample replies above are examples only — your bot answers from its own
        knowledge base once you add sources.
      </p>
    </div>
  );
}
