// Server-only: calls Lovable AI Gateway to embed text.
// 1536d, matches the pgvector column.

const GATEWAY = "https://ai.gateway.lovable.dev/v1/embeddings";
const MODEL = "openai/text-embedding-3-small";

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  if (texts.length === 0) return [];

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, input: texts }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embedding gateway error ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data.map((d) => d.embedding);
}

export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v;
}

/**
 * Naive paragraph-aware chunker: ~maxChars per chunk with overlap.
 */
export function chunkText(
  text: string,
  maxChars = 900,
  overlap = 120,
): { content: string; index: number }[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const chunks: { content: string; index: number }[] = [];
  let start = 0;
  let idx = 0;
  while (start < clean.length) {
    let end = Math.min(start + maxChars, clean.length);
    if (end < clean.length) {
      const breakAt = clean.lastIndexOf("\n\n", end);
      if (breakAt > start + maxChars * 0.5) end = breakAt;
      else {
        const dot = clean.lastIndexOf(". ", end);
        if (dot > start + maxChars * 0.5) end = dot + 1;
      }
    }
    const content = clean.slice(start, end).trim();
    if (content) chunks.push({ content, index: idx++ });
    if (end >= clean.length) break;
    start = Math.max(end - overlap, end);
  }
  return chunks;
}