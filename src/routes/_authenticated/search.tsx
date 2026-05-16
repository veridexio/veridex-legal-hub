import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search as SearchIcon, Sparkles, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: "Search — Veridex" }] }),
  component: SearchPage,
});

type Hit = {
  id: string;
  kind: "regulation" | "document";
  title: string;
  excerpt: string | null;
  jurisdiction: string | null;
};

function SearchPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Hit[]>([]);

  const { data: history } = useQuery({
    queryKey: ["search-history"],
    queryFn: async () => {
      const { data } = await supabase.from("searches").select("*").order("created_at", { ascending: false }).limit(8);
      return data ?? [];
    },
  });

  const runSearch = useMutation({
    mutationFn: async (query: string) => {
      const [{ data: regs }, { data: docs }] = await Promise.all([
        supabase.from("regulations").select("id, title, summary, jurisdiction").or(`title.ilike.%${query}%,summary.ilike.%${query}%`).limit(10),
        supabase.from("documents").select("id, title, description, jurisdiction").or(`title.ilike.%${query}%,description.ilike.%${query}%`).limit(10),
      ]);
      const hits: Hit[] = [
        ...(regs ?? []).map((r) => ({ id: r.id, kind: "regulation" as const, title: r.title, excerpt: r.summary, jurisdiction: r.jurisdiction })),
        ...(docs ?? []).map((d) => ({ id: d.id, kind: "document" as const, title: d.title, excerpt: d.description, jurisdiction: d.jurisdiction })),
      ];
      if (user) {
        await supabase.from("searches").insert({ user_id: user.id, query, result_count: hits.length });
      }
      return hits;
    },
    onSuccess: (hits) => {
      setResults(hits);
      qc.invalidateQueries({ queryKey: ["search-history"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });

  return (
    <div>
      <PageHeader eyebrow="Discover" title="Search" description="Query regulations and your documents. AI-powered semantic search is wired in and ready to enable." />

      <Card className="p-5 mb-6">
        <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) runSearch.mutate(q.trim()); }} className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search regulations, documents, citations..." className="pl-10" />
          </div>
          <Button type="submit" disabled={runSearch.isPending}>Search</Button>
          <Button type="button" variant="outline" disabled title="AI mode (coming soon)">
            <Sparkles className="h-4 w-4 mr-2" />AI mode
          </Button>
        </form>
      </Card>

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          {results.length === 0 ? (
            <EmptyState icon={SearchIcon} title={runSearch.isSuccess ? "No results" : "Start searching"} description="Try jurisdiction codes, authority names, or excerpts." />
          ) : (
            <ul className="space-y-3">
              {results.map((h) => (
                <Card key={`${h.kind}-${h.id}`} className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="uppercase text-[10px] tracking-wide">{h.kind}</Badge>
                    {h.jurisdiction && <span className="text-xs text-muted-foreground">{h.jurisdiction}</span>}
                  </div>
                  <h3 className="font-serif text-xl">{h.title}</h3>
                  {h.excerpt && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{h.excerpt}</p>}
                </Card>
              ))}
            </ul>
          )}
        </div>

        <Card className="p-5 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-serif text-lg">Recent searches</h2>
          </div>
          {!history || history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No history yet.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((s) => (
                <li key={s.id}>
                  <button
                    className="text-sm text-foreground hover:text-primary text-left w-full truncate"
                    onClick={() => { setQ(s.query); runSearch.mutate(s.query); }}
                  >
                    {s.query} <span className="text-muted-foreground text-xs">· {s.result_count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
