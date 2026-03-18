"use client";
import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, ChevronDown } from "lucide-react";

type Message = { id: string; role: "user" | "assistant"; content: string };

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    setError(null);
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error"); return; }
      setMessages(prev => [...prev, { id: Date.now().toString() + "_a", role: "assistant", content: data.content }]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all"
        aria-label="Open assistant"
      >
        {open ? <ChevronDown className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
      </button>

      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-[380px] h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              <span className="font-semibold text-sm">DataBridge Assistant</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 text-sm mt-8">
                <Bot className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                <p className="font-medium text-gray-500">Hi! I'm your DataBridge assistant.</p>
                <p className="mt-1 text-xs">Try asking:</p>
                <div className="mt-2 space-y-1">
                  {[
                    "如何创建一个模板？",
                    "查看最近失败的 jobs",
                    "查看最近 7 天的统计",
                    "批量审批所有待审批的 jobs",
                  ].map(s => (
                    <button key={s} onClick={() => sendMessage(s)}
                      className="block w-full text-left text-xs bg-gray-50 hover:bg-blue-50 hover:text-blue-600 px-3 py-1.5 rounded-lg transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(m => (
              <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user" ? "bg-blue-600 text-white rounded-br-sm" : "bg-gray-100 text-gray-800 rounded-bl-sm"
                }`}>
                  {m.content}
                </div>
                {m.role === "user" && (
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSubmit} className="p-3 border-t border-gray-100 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask me anything..."
              disabled={isLoading}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            />
            <button type="submit" disabled={isLoading || !input.trim()}
              className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 shrink-0">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
