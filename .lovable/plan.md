# Plan: PDF Upload & Text Extraction for Ingestion

You picked option 1 — the biggest gap is that users currently have to paste raw text into the upload form. We'll let them upload a PDF instead and extract the text automatically before chunking and embedding.

## Goal

On the `/upload` page, a user can drop a PDF file. The app extracts the text server-side, then runs it through the existing ingestion pipeline (chunk → embed → store in `document_chunks`). Pasted text remains supported as a fallback.

## Scope

In scope:
- PDF file upload (single file, up to ~10 MB)
- Server-side text extraction from the PDF
- Reuse existing `ingestDocument` flow for chunking/embedding/storage
- Show extraction progress + page count + preview of extracted text before commit
- Graceful error if the PDF is image-only / has no extractable text

Out of scope (future):
- OCR for scanned/image PDFs (needs Tesseract or a vision model — heavier lift)
- DOCX, HTML, EPUB ingestion
- Multi-file batch upload
- URL ingestion ("paste a regulator link")

## Technical approach

**PDF parsing library:** `unpdf` — pure JS, works in Cloudflare Workers (no Node-only deps, no native binaries). The popular `pdf-parse` package depends on Node fs and breaks in our Worker runtime, so we avoid it.

**Flow:**
1. `upload.tsx` — add a file input + drag/drop zone alongside the existing text fields. On file select, read the PDF as `ArrayBuffer` and send to a new server fn `extractPdfText`.
2. `src/lib/pdf-extract.functions.ts` — new server fn:
   - Input: `{ fileBase64: string, filename: string }`
   - Calls `unpdf.extractText()` → returns `{ text, pageCount }`
   - Throws a typed error if extracted text is empty (likely scanned)
3. Client receives extracted text, shows a preview ("Extracted 12 pages, 8,432 characters") and pre-fills the existing `content_text` field. User confirms title/source and clicks Ingest.
4. Existing `ingestDocument` server fn runs unchanged — chunking + embedding + DB insert.

**Auth:** both server fns use `requireSupabaseAuth` (matches existing `ingestDocument`).

**Files:**
- new: `src/lib/pdf-extract.functions.ts`
- new: `src/components/pdf-dropzone.tsx` (drag/drop UI + file picker)
- edit: `src/routes/_authenticated/upload.tsx` (mount dropzone, wire extraction → preview → existing ingest button)
- install: `unpdf`

**Failure modes handled:**
- File > 10 MB → reject client-side with clear message
- Non-PDF mime → reject client-side
- Empty extracted text → server returns `{ error: "scanned_pdf" }`, UI tells user to paste text manually or wait for OCR support
- Extraction throws → surface the error message, keep the paste fallback usable

## What this unblocks

After this ships, the demo flow becomes "drag in a regulation PDF → search it" instead of "open the PDF, select all, copy, paste, ingest." That's the difference between a toy and something you'd show a compliance lead.
