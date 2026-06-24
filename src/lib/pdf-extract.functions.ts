import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Extract text from a PDF uploaded as base64. Pure-JS via unpdf — works on Workers.
 * Returns { text, pageCount }. Throws when the PDF appears to be scanned/image-only.
 */
export const extractPdfText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileBase64: string; filename: string }) =>
    z
      .object({
        fileBase64: z.string().min(1).max(20_000_000),
        filename: z.string().min(1).max(300),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const bin = Uint8Array.from(atob(data.fileBase64), (c) => c.charCodeAt(0));
    if (bin.byteLength > 10 * 1024 * 1024) {
      throw new Error("PDF exceeds 10 MB limit");
    }
    const pdf = await getDocumentProxy(bin);
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    const joined = (Array.isArray(text) ? text.join("\n\n") : text).trim();
    if (joined.length < 20) {
      throw new Error(
        "No extractable text found. This PDF may be scanned/image-only — paste text manually for now.",
      );
    }
    return { text: joined, pageCount: totalPages, filename: data.filename };
  });