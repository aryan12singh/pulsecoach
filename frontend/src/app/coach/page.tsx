"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ChatMessage } from "@/types";

export default function CoachPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.coaching.history().then((h) => {
      const sorted = [...h].reverse();
      setMessages(sorted);
      // Auto weekly check-in if no history
      if (sorted.length === 0) {
        send("Give me my weekly check-in");
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const msg = await api.coaching.chat(text);
      setMessages((m) => [...m, msg]);
    } catch {
      alert("Coaching request failed — check that ENABLE_COACHING and ANTHROPIC_API_KEY are set.");
    } finally {
      setSending(false);
      setInput("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await send(input);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Coach</h1>

      <div className="bg-white rounded-xl shadow-sm p-5 space-y-5 min-h-[400px] max-h-[600px] overflow-y-auto">
        {messages.map((m) => (
          <div key={m.id} className="space-y-3">
            <div className="flex justify-end">
              <div className="bg-indigo-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-xs">
                {m.user_message}
              </div>
            </div>
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-800 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-prose whitespace-pre-wrap">
                {m.ai_response}
              </div>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-400 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm animate-pulse">
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your coach…"
          disabled={sending}
          className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
