import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { Send, Loader2, Sparkles, Trash2, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { useLocalDocs, readChat, writeChat, clearChat } from "@/lib/local-docs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Chat — Veridex" }] }),
  component: ChatPage,
});

const SUGGESTIONS = [
  "Summarize the key obligations in my uploaded documents.",
  "What are the customs duties on imported electronics in the EU?",
  "Explain data localization rules for fintechs.",
  "What does a free trade agreement typically cover?",
];

function ChatPage() {
  const { docs } = useLocalDocs();
  const [initialMessages] = useState<UIMessage[]>(() => readChat<UIMessage>());
  const [input, setInput] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, error, setMessages } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        documents: docs.map((d) => ({ title: d.title, text: d.text })),
      }),
    }),
    onError: (e) => toast.error(e.message),
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    writeChat(messages);
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    if (!isLoading) textareaRef.current?.focus();
  }, [isLoading]);

  function submit(text?: string) {
    const value = (text ?? input).trim();
    if (!value || isLoading) return;
    sendMessage({ text: value });
    setInput("");
  }

  function reset() {
    setMessages([]);
    clearChat();
  }

  return (
    <div>
      <PageHeader
        eyebrow="AI assistant"
        title="Chat with Veridex"
        description="Ask anything about trade, regulations, or your uploaded documents."
      />

      <div className="grid lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-3 flex flex-col h-[calc(100vh-15rem)] overflow-hidden">
          <div ref={scroller} className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
                <div className="h-12 w-12 rounded-md bg-accent text-accent-foreground flex items-center justify-center mb-4 font-serif text-xl">
                  V
                </div>
                <h2 className="font-serif text-2xl">How can I help today?</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  I answer trade, customs, and regulatory questions —
                  grounded in your saved documents when available.
                </p>
                <div className="grid sm:grid-cols-2 gap-2 mt-6 w-full">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => submit(s)}
                      className="text-left text-sm p-3 rounded-md border border-border hover:bg-muted/50 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => {
              const text = m.parts
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("");
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={cn("flex", isUser ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-4 py-3",
                      isUser
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground",
                    )}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap text-sm">{text}</p>
                    ) : (
                      <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-serif prose-p:my-2 prose-li:my-0">
                        <ReactMarkdown>{text}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {status === "submitted" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive">{error.message}</p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="border-t border-border p-3 flex items-end gap-2 bg-background"
          >
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Ask about a regulation, treaty, or your documents…"
              rows={1}
              className="min-h-[44px] max-h-40 resize-none"
              disabled={isLoading}
              autoFocus
            />
            <Button type="submit" disabled={isLoading || !input.trim()} size="icon" className="h-11 w-11 shrink-0">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-lg flex items-center gap-2">
                <FileText className="h-4 w-4" /> Context
              </h3>
              <Badge variant="outline" className="text-[10px]">
                {docs.length}
              </Badge>
            </div>
            {docs.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No documents loaded. Upload one to ground answers in your own
                sources.
              </p>
            ) : (
              <ul className="space-y-2">
                {docs.map((d) => (
                  <li key={d.id} className="text-xs">
                    <p className="font-medium truncate text-foreground">{d.title}</p>
                    <p className="text-muted-foreground">
                      {d.text.length.toLocaleString()} chars
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5 bg-muted/30">
            <h3 className="font-serif text-base mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> About
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Veridex uses Lovable AI to answer trade & regulatory questions.
              Your conversation is stored only in this browser.
            </p>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 w-full justify-start text-xs"
                onClick={reset}
              >
                <Trash2 className="h-3 w-3 mr-2" /> Clear conversation
              </Button>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}