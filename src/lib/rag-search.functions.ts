import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { embedOne } from "./embeddings.server";
import {
  computeConfidence,
  type SourceType,
} from "./source-authority";

const INSUFFICIENT =
  "Insufficient verified evidence found in the current document set.";

const filterSchema = z
  .object({
    jurisdiction: z.string().max(80).nullable().optional(),
    sourceType: z
      .enum([
        "government_gazette",
        "ministry_regulation",
        "regulator_guidance",
        "trade_agreement",
        "policy_document",
        "unofficial_source",
      ])
      .nullable()
      .optional(),
  })
  .optional();

export type RetrievedChunk = {
  id: string;
  content: string;
  section: string | null;
  pageNumber: number | null;
  documentId: string | null;
  regulationId: string | null;
  similarity: number;
  title: string;
  jurisdiction: string | null;
  sourceType: SourceType | null;
};

async function retrieve(
  supabase: any,
  userId: string,
  query: string,
  filters: z.infer<typeof filterSchema>,
  k = 8,
): Promise<{ chunks: RetrievedChunk[]; latencyMs: number }> {
  const t0 = Date.now();
  const embedding = await embedOne(query);
  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: embedding as unknown as string,
    match_count: k,
    filter_jurisdiction: filters?.jurisdiction ?? null,
    filter_source_type: filters?.sourceType ?? null,
    requesting_user: userId,
  });
  if (error) throw new Error(`Retrieval failed: ${error.message}`);
  const chunks: RetrievedChunk[] = (data ?? []).map((r: any) => ({
    id: r.id,
    content: r.content,
    section: r.section,
    pageNumber: r.page_number,
    documentId: r.document_id,
    regulationId: r.regulation_id,
    similarity: Number(r.similarity ?? 0),
    title: r.reg_title ?? r.doc_title ?? "Untitled",
    jurisdiction: r.jurisdiction,
    sourceType: (r.source_type ?? null) as SourceType | null,
  }));
  return { chunks, latencyMs: Date.now() - t0 };
}

export const semanticSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    query: string;
    filters?: { jurisdiction?: string | null; sourceType?: SourceType | null };
    k?: number;
  }) =>
    z
      .object({
        query: z.string().min(2).max(500),
        filters: filterSchema,
        k: z.number().int().min(1).max(20).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { chunks, latencyMs } = await retrieve(
      supabase,
      userId,
      data.query,
      data.filters,
      data.k ?? 8,
    );
    return { chunks, latencyMs };
  });

const SYSTEM_PROMPT = `You are Veridex, an evidence-first regulatory intelligence assistant.

STRICT RULES:
- Answer ONLY using the EVIDENCE provided below.
- If the evidence does not clearly support an answer, respond exactly: "${INSUFFICIENT}"
- Never invent statutes, articles, citations, dates, or jurisdictions.
- Do NOT give legal advice. Summarize what the evidence says.
- Prefer precision over breadth. Be concise (3-6 sentences).
- When you reference a clause, mention the document/regulation title in plain text. Citations are tracked separately.
- If sources conflict, surface the conflict; do not pick a side.
- Higher-authority sources (government gazette, ministry regulation, trade agreement) take precedence over unofficial sources.`;

function formatEvidence(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => {
      const meta = [
        c.title,
        c.jurisdiction ? `jurisdiction: ${c.jurisdiction}` : null,
        c.sourceType ? `source: ${c.sourceType}` : null,
        c.section ? `section: ${c.section}` : null,
      ]
        .filter(Boolean)
        .join(" | ");
      return `[${i + 1}] (${meta})\n${c.content}`;
    })
    .join("\n\n---\n\n");
}

async function callLLM(query: string, chunks: RetrievedChunk[]): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `QUESTION:\n${query}\n\nEVIDENCE:\n${formatEvidence(chunks)}`,
        },
      ],
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("Rate limit exceeded. Please retry shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Lovable settings.");
    throw new Error(`AI gateway error ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  return json.choices?.[0]?.message?.content?.trim() ?? INSUFFICIENT;
}

export const ragAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    query: string;
    filters?: { jurisdiction?: string | null; sourceType?: SourceType | null };
  }) =>
    z
      .object({
        query: z.string().min(2).max(500),
        filters: filterSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tStart = Date.now();

    const { chunks, latencyMs: retrievalLatency } = await retrieve(
      supabase,
      userId,
      data.query,
      data.filters,
      8,
    );

    const topSim = chunks[0]?.similarity ?? 0;
    const hasEnoughEvidence = chunks.length >= 1 && topSim >= 0.35;

    let answer = INSUFFICIENT;
    let aiLatency = 0;

    if (hasEnoughEvidence) {
      // Limit evidence sent to LLM to top 6
      const evidence = chunks.slice(0, 6);
      const aiStart = Date.now();
      try {
        answer = await callLLM(data.query, evidence);
      } catch (e) {
        answer = `Retrieval succeeded but answer generation failed: ${
          (e as Error).message
        }`;
      }
      aiLatency = Date.now() - aiStart;
    }

    const confidence = hasEnoughEvidence
      ? computeConfidence({
          similarities: chunks.slice(0, 6).map((c) => c.similarity),
          authorities: chunks.slice(0, 6).map((c) => c.sourceType),
        })
      : 0;

    const jurisdictions = Array.from(
      new Set(chunks.map((c) => c.jurisdiction).filter(Boolean)),
    ) as string[];

    const sourceAuthority = chunks.length
      ? chunks
          .map((c) => c.sourceType ?? "unofficial_source")
          .sort()[0]
      : null;

    // Log for admin debug
    try {
      await (supabase as any).from("rag_logs").insert({
        user_id: userId,
        query: data.query,
        retrieval_count: chunks.length,
        retrieval_latency_ms: retrievalLatency,
        ai_latency_ms: aiLatency,
        confidence,
        top_similarity: topSim,
        status: hasEnoughEvidence ? "ok" : "insufficient",
      });
      await (supabase as any).from("searches").insert({
        user_id: userId,
        query: data.query,
        result_count: chunks.length,
      });
    } catch {
      // non-fatal
    }

    return {
      answer,
      confidence,
      retrievedChunks: chunks,
      jurisdictions,
      sourceAuthority,
      retrievalLatencyMs: retrievalLatency,
      aiLatencyMs: aiLatency,
      totalLatencyMs: Date.now() - tStart,
      hasEvidence: hasEnoughEvidence,
    };
  });