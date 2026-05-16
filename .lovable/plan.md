
# Veridex → Evidence-First RAG Upgrade

## Reality check
The current DB has **no `document_chunks` table and no pgvector extension**. The summary said otherwise but inspection shows neither exists. Everything below is built from scratch.

## What I'll build

### 1. Database (migration)
- Enable `vector` extension
- Add `source_type` enum + column to `documents` and `regulations` (gov_gazette, ministry_regulation, regulator_guidance, trade_agreement, policy_document, unofficial_source)
- New `document_chunks`: `id, document_id, regulation_id, chunk_index, content, page_number, section, embedding vector(1536), tokens, created_at`
- IVFFlat index on embedding (cosine)
- RLS: read if the parent document is readable (mirror documents policy); admins manage
- New `rag_logs`: query, latency_ms, retrieval_count, ai_latency_ms, confidence, user_id — admin-readable
- New `documents.content_text` column to hold extracted body text (paste-on-upload for now; OCR future)

### 2. Server functions (`src/lib/`)
- `embeddings.server.ts` — calls Lovable AI Gateway `/v1/embeddings` with `openai/text-embedding-3-small` (1536d)
- `ingestion.functions.ts` — `processDocument({ documentId })`: chunk content_text (~800 chars, 100 overlap), embed batch, upsert chunks, mark `documents.status = ready`
- `rag-search.functions.ts` —
  - `semanticSearch({ query, filters })` → top-k chunks with metadata + scores via `<=>` cosine
  - `ragAnswer({ query, filters })` → retrieve → call `google/gemini-3-flash-preview` with strict evidence-only system prompt → return `{ answer, citations, confidence_score, retrieved_chunks, jurisdictions, source_authority }`; refuses with "Insufficient verified evidence found in the current document set." when top score < threshold or <2 chunks
  - confidence = weighted(avg similarity, chunk count, authority)
- `admin-debug.functions.ts` — chunk counts, recent rag_logs, failed documents

### 3. UI
- Rewrite `src/routes/_authenticated/search.tsx`:
  - Natural-language query box + suggested prompts chips
  - Filters: jurisdiction, source_type, authority
  - AI Answer card (top): answer text, confidence badge, jurisdictions, low-confidence warning
  - Collapsible **"Why this answer?"** panel with retrieved chunks
  - Citation cards list (regulation/doc title, section, jurisdiction, authority badge, excerpt, score, verified)
  - Recent searches sidebar (existing `searches` table)
- New `src/components/citation-card.tsx`, `authority-badge.tsx`, `confidence-indicator.tsx`
- Update `upload.tsx`: add "Document content / paste text" textarea + auto-trigger `processDocument` after insert; show ingestion status
- Update `admin.tsx`: add Debug section (chunk totals, latency, failed docs, recent retrievals)
- `regulations.tsx`: display authority badge

### 4. Wiring
- `src/start.ts` already has `attachSupabaseAuth`
- All server fns use `requireSupabaseAuth`; embeddings/AI calls inside handler read `process.env.LOVABLE_API_KEY`

### Out of scope (called out to user)
- PDF/OCR text extraction (workers runtime can't run sharp/pdf-parse reliably) — content must be pasted for now
- Real re-ranker; we use cosine similarity only

Proceeding directly — no clarifying questions needed.
