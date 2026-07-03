"use client";
import { useEffect, useRef, useState } from "react";
import { api, handleError } from "@/lib/api";
import type { AppConfig, ChatMessage } from "@/types";
import { Send, Sparkles } from "lucide-react";
import { Card, Badge, Button, Skeleton, EmptyState } from "@/components/ui";
import { Input } from "@/components/ui/FormFields";
import { toast } from "sonner";

const SUGGESTIONS = [
  "Give me my weekly check-in",
  "How\u2019s my sleep?",
  "Should I take a deload week?",
  "How\u2019s my bench progressing?",
];

export default function CoachPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.config().then(setConfig).catch((e) => handleError(e, "Failed to load config")).finally(() => setConfigLoading(false));
  }, []);

  useEffect(() => {
    if (!config?.coaching_enabled) return;
    api.coaching.history().then((h) => {
      setMessages([...h].reverse());
    }).catch((e) => handleError(e, "Failed to load coaching history"));
  }, [config]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  async function send(text: string) {
    if (!text.trim() || sending) return;
    setSending(true);
    setInput("");
    try {
      const msg = await api.coaching.chat(text);
      setMessages((m) => [...m, msg]);
    } catch {
      toast.error("Coaching request failed \u2014 check that coaching is enabled.");
    } finally {
      setSending(false);
    }
  }

  if (configLoading) return (
    <div className="animate-fade-up" style={{ maxWidth: 760, margin: "0 auto" }}>
      <Skeleton h={400} r={16} style={{ width: "100%" }} />
    </div>
  );

  if (!config?.coaching_enabled) return (
    <div className="animate-fade-up" style={{ maxWidth: 760, margin: "0 auto" }}>
      <Card>
        <EmptyState
          icon={Sparkles}
          title="Coaching disabled"
          body="Contact your admin to enable AI coaching."
        />
      </Card>
    </div>
  );

  return (
    <div className="animate-fade-up" style={{ maxWidth: 760, margin: "0 auto" }}>
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-display font-semibold text-[30px] tracking-[-0.02em]">Coach</h1>
        </div>
        <Badge tone="accent" dot>AI enabled</Badge>
      </div>

      <Card pad={false} style={{ display: "flex", flexDirection: "column", height: "min(64vh, 560px)" }}>
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-[22px] flex flex-col gap-[18px]"
        >
          {/* AI header */}
          <div className="flex items-center gap-3 pb-1.5">
            <span
              className="w-[34px] h-[34px] rounded-[11px] grid place-items-center"
              style={{ background: "var(--accent)", color: "var(--on-accent)" }}
            >
              <Sparkles size={17} />
            </span>
            <div>
              <div className="font-display font-semibold text-sm">PulseCoach AI</div>
              <div className="text-muted text-xs">Answers from your last 14 days of data</div>
            </div>
          </div>

          {/* Empty state */}
          {messages.length === 0 && !sending && (
            <div className="flex-1 flex items-center justify-center text-center py-8">
              <div>
                <div className="text-muted text-sm">No conversations yet.</div>
                <div className="text-faint text-xs mt-1">Ask a question or pick a suggestion below.</div>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((m) => (
            <div key={m.id} className="flex flex-col gap-3">
              {/* User bubble */}
              <div className="self-end max-w-[78%]">
                <div
                  className="text-sm font-medium"
                  style={{
                    background: "var(--accent)",
                    color: "var(--on-accent)",
                    padding: "11px 15px",
                    borderRadius: "16px 16px 4px 16px",
                  }}
                >
                  {m.user_message}
                </div>
              </div>
              {/* AI bubble */}
              <div className="self-start max-w-[88%]">
                <div
                  className="text-sm leading-relaxed whitespace-pre-wrap"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    padding: "13px 16px",
                    borderRadius: "16px 16px 16px 4px",
                  }}
                >
                  {m.ai_response}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {sending && (
            <div className="self-start">
              <div
                className="flex items-center gap-2 text-muted text-sm"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  padding: "13px 16px",
                  borderRadius: "16px 16px 16px 4px",
                }}
              >
                <TypingDots /> Thinking&hellip;
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div style={{ borderTop: "1px solid var(--border)", padding: 16 }}>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-surface-2 border border-border text-muted hover:text-text hover:border-text/20 transition-colors cursor-pointer disabled:opacity-40"
                onClick={() => send(s)}
                disabled={sending}
              >
                {s}
              </button>
            ))}
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => { e.preventDefault(); send(input); }}
          >
            <Input
              placeholder="Ask your coach\u2026"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
              style={{ flex: 1 }}
            />
            <Button
              type="submit"
              variant="primary"
              icon={Send}
              disabled={sending || !input.trim()}
            >
              Send
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block rounded-full"
          style={{
            width: 6,
            height: 6,
            background: "var(--muted)",
            animation: `blink 1.2s ${i * 0.18}s infinite`,
          }}
        />
      ))}
      <style>{`@keyframes blink{0%,60%,100%{opacity:.25}30%{opacity:1}}`}</style>
    </span>
  );
}
