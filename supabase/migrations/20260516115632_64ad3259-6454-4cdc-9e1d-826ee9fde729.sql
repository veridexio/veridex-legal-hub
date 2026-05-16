
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Source authority enum
CREATE TYPE public.source_type AS ENUM (
  'government_gazette',
  'ministry_regulation',
  'regulator_guidance',
  'trade_agreement',
  'policy_document',
  'unofficial_source'
);

ALTER TABLE public.documents ADD COLUMN source_type public.source_type DEFAULT 'unofficial_source';
ALTER TABLE public.documents ADD COLUMN content_text text;
ALTER TABLE public.regulations ADD COLUMN source_type public.source_type DEFAULT 'regulator_guidance';

-- Chunks
CREATE TABLE public.document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  regulation_id uuid REFERENCES public.regulations(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL DEFAULT 0,
  content text NOT NULL,
  section text,
  page_number integer,
  tokens integer,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (document_id IS NOT NULL OR regulation_id IS NOT NULL)
);

CREATE INDEX document_chunks_doc_idx ON public.document_chunks(document_id);
CREATE INDEX document_chunks_reg_idx ON public.document_chunks(regulation_id);
CREATE INDEX document_chunks_embedding_idx ON public.document_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read chunks if parent readable" ON public.document_chunks
  FOR SELECT TO authenticated USING (
    (document_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
    ))
    OR
    (regulation_id IS NOT NULL)
  );

CREATE POLICY "Admins manage chunks" ON public.document_chunks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners insert chunks for own docs" ON public.document_chunks
  FOR INSERT TO authenticated WITH CHECK (
    document_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.documents d WHERE d.id = document_id AND d.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners delete chunks for own docs" ON public.document_chunks
  FOR DELETE TO authenticated USING (
    document_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.documents d WHERE d.id = document_id AND d.owner_id = auth.uid()
    )
  );

-- RPC for vector search (bypasses RLS where needed via security definer; filters by user access)
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector(1536),
  match_count integer DEFAULT 8,
  filter_jurisdiction text DEFAULT NULL,
  filter_source_type public.source_type DEFAULT NULL,
  requesting_user uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  section text,
  page_number integer,
  document_id uuid,
  regulation_id uuid,
  similarity float,
  doc_title text,
  reg_title text,
  jurisdiction text,
  source_type public.source_type
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    c.id, c.content, c.section, c.page_number, c.document_id, c.regulation_id,
    1 - (c.embedding <=> query_embedding) AS similarity,
    d.title AS doc_title,
    r.title AS reg_title,
    COALESCE(d.jurisdiction, r.jurisdiction) AS jurisdiction,
    COALESCE(d.source_type, r.source_type) AS source_type
  FROM public.document_chunks c
  LEFT JOIN public.documents d ON d.id = c.document_id
  LEFT JOIN public.regulations r ON r.id = c.regulation_id
  WHERE c.embedding IS NOT NULL
    AND (filter_jurisdiction IS NULL OR COALESCE(d.jurisdiction, r.jurisdiction) = filter_jurisdiction)
    AND (filter_source_type IS NULL OR COALESCE(d.source_type, r.source_type) = filter_source_type)
    AND (
      c.regulation_id IS NOT NULL
      OR (requesting_user IS NOT NULL AND d.owner_id = requesting_user)
      OR public.has_role(requesting_user, 'admin'::app_role)
    )
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- RAG logs (admin debug)
CREATE TABLE public.rag_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  query text NOT NULL,
  retrieval_count integer DEFAULT 0,
  retrieval_latency_ms integer,
  ai_latency_ms integer,
  confidence numeric,
  top_similarity numeric,
  status text DEFAULT 'ok',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rag_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read rag logs" ON public.rag_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated insert own rag logs" ON public.rag_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
