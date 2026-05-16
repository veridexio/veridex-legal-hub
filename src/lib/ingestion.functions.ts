import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chunkText, embedTexts } from "./embeddings.server";

/**
 * Process a document: chunk its content_text, embed, and store in document_chunks.
 * Idempotent: deletes any existing chunks for the document before re-ingesting.
 */
export const processDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { documentId: string }) =>
    z.object({ documentId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: doc, error: docErr } = await (supabase as any)
      .from("documents")
      .select("id, owner_id, content_text, title, status")
      .eq("id", data.documentId)
      .maybeSingle();
    if (docErr) throw new Error(docErr.message);
    if (!doc) throw new Error("Document not found");
    if (doc.owner_id !== userId) throw new Error("Forbidden");
    if (!doc.content_text || doc.content_text.trim().length < 20) {
      await (supabase as any)
        .from("documents")
        .update({ status: "failed" })
        .eq("id", data.documentId);
      throw new Error("Document has no extractable text. Paste content on upload.");
    }

    await (supabase as any).from("documents").update({ status: "processing" }).eq("id", data.documentId);
    await (supabase as any).from("document_chunks").delete().eq("document_id", data.documentId);

    const pieces = chunkText(doc.content_text);
    if (pieces.length === 0) {
      await (supabase as any).from("documents").update({ status: "failed" }).eq("id", data.documentId);
      return { chunks: 0 };
    }

    // Batch embed in groups of 32
    const BATCH = 32;
    let stored = 0;
    for (let i = 0; i < pieces.length; i += BATCH) {
      const slice = pieces.slice(i, i + BATCH);
      const embeds = await embedTexts(slice.map((p) => p.content));
      const rows = slice.map((p, j) => ({
        document_id: data.documentId,
        chunk_index: p.index,
        content: p.content,
        embedding: embeds[j] as unknown as string,
        tokens: Math.round(p.content.length / 4),
      }));
      const { error: insErr } = await (supabase as any).from("document_chunks").insert(rows);
      if (insErr) {
        await (supabase as any).from("documents").update({ status: "failed" }).eq("id", data.documentId);
        throw new Error(`Failed to store chunks: ${insErr.message}`);
      }
      stored += rows.length;
    }

    await (supabase as any).from("documents").update({ status: "ready" }).eq("id", data.documentId);
    return { chunks: stored };
  });