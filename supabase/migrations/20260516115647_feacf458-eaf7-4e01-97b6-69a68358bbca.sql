
REVOKE EXECUTE ON FUNCTION public.match_chunks(vector, integer, text, public.source_type, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.match_chunks(vector, integer, text, public.source_type, uuid) TO authenticated;
