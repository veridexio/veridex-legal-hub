import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

type ChatRequestBody = {
  messages?: unknown;
  documents?: { title: string; text: string }[];
};

const SYSTEM_PROMPT = `You are Veridex, an AI assistant for trade and regulatory intelligence.

Answer the user's questions about trade rules, regulations, customs, compliance, and policy.
- Be clear, concise, and professional.
- Use markdown for structure (headings, bullets) when helpful.
- If the user has uploaded documents (provided below), prefer those as your primary source and cite the document title inline.
- If you don't know something or the documents don't cover it, say so honestly. Never fabricate citations or statutes.
- Do not give legal advice; provide informational summaries.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(body.messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const docs = Array.isArray(body.documents) ? body.documents : [];
        const docContext = docs.length
          ? `\n\nUSER DOCUMENTS:\n` +
            docs
              .map(
                (d, i) =>
                  `[Document ${i + 1}: ${d.title}]\n${d.text.slice(0, 12000)}`,
              )
              .join("\n\n---\n\n")
          : "";

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: SYSTEM_PROMPT + docContext,
          messages: await convertToModelMessages(body.messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages as UIMessage[],
        });
      },
    },
  },
});