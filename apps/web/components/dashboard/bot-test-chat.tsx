"use client";

import { useRef, useState } from "react";
import { Send, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Bot } from "@velobot/shared";

interface TestMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

/** Parses an SSE response body into `{ event, data }` chunks — same framing used by the widget's api.ts. */
async function* parseSSE(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event:"));
      const dataLine = lines.find((l) => l.startsWith("data:"));
      if (!eventLine || !dataLine) continue;
      try {
        yield { event: eventLine.slice(6).trim(), data: JSON.parse(dataLine.slice(5).trim()) };
      } catch {
        // skip malformed chunk
      }
    }
  }
}

export function BotTestChat({ bot }: { bot: Bot }) {
  const [messages, setMessages] = useState<TestMessage[]>([
    { id: "welcome", role: "assistant", content: bot.welcome_message },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput("");
    const priorHistory = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: text }]);
    scrollToBottom();

    const assistantId = `a-${Date.now()}`;
    let fullText = "";
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const res = await fetch(`/api/bots/${bot.id}/test-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: priorHistory }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, role: "system", content: body.error ?? "Request failed." } : m))
        );
        return;
      }

      for await (const evt of parseSSE(res)) {
        if (evt.event === "token") {
          fullText += evt.data.token;
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: fullText } : m)));
          scrollToBottom();
        } else if (evt.event === "error") {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, role: "system", content: evt.data.message } : m))
          );
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, role: "system", content: "Could not reach the bot." } : m))
      );
    } finally {
      setSending(false);
    }
  }

  function handleReset() {
    setMessages([{ id: "welcome", role: "assistant", content: bot.welcome_message }]);
  }

  return (
    <Card className="mt-4">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Test this bot</CardTitle>
          <CardDescription>
            Talks directly to the same RAG pipeline as the embedded widget — nothing here is saved
            to conversations or the agent inbox.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} type="button">
          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex h-[420px] flex-col rounded-lg border">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
            <div className="flex flex-col gap-3">
              {messages.map((m) => (
                <div key={m.id} className={cn("flex flex-col gap-1", m.role === "user" ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm",
                      m.role === "user"
                        ? "text-white"
                        : m.role === "system"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-secondary text-secondary-foreground"
                    )}
                    style={m.role === "user" ? { backgroundColor: bot.theme_color } : undefined}
                  >
                    {m.content || (sending && m.role === "assistant" ? "…" : "")}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <form onSubmit={handleSend} className="flex items-end gap-2 border-t p-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder="Ask this bot a question..."
              className="min-h-[40px] flex-1 resize-none"
              disabled={sending}
            />
            <Button type="submit" size="icon" disabled={sending || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
