import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDebugStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await (supabase as any).rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const [chunks, failed, logs] = await Promise.all([
      (supabase as any).from("document_chunks").select("id", { count: "exact", head: true }),
      (supabase as any).from("documents").select("id, title, updated_at").eq("status", "failed").limit(10),
      (supabase as any)
        .from("rag_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

    const recent = (logs.data ?? []) as any[];
    const avgRetrieval =
      recent.length === 0
        ? 0
        : Math.round(
            recent.reduce((a, r) => a + (r.retrieval_latency_ms ?? 0), 0) /
              recent.length,
          );
    const avgAi =
      recent.length === 0
        ? 0
        : Math.round(
            recent.reduce((a, r) => a + (r.ai_latency_ms ?? 0), 0) / recent.length,
          );

    return {
      totalChunks: chunks.count ?? 0,
      failedDocuments: (failed.data ?? []) as { id: string; title: string; updated_at: string }[],
      recentLogs: recent,
      avgRetrievalMs: avgRetrieval,
      avgAiMs: avgAi,
    };
  });