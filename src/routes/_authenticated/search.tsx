import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Search as SearchIcon,
  Sparkles,
  Clock,
  AlertTriangle,
  ChevronDown,
  Loader2,
  Filter as FilterIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { CitationCard } from "@/components/citation-card";
import { AuthorityBadge } from "@/components/authority-badge";
import { ConfidenceIndicator } from "@/components/confidence-indicator";
import { ragAnswer } from "@/lib/rag-search.functions";
import { SOURCE_TYPE_LABELS, type SourceType } from "@/lib/source-authority";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: "Search — Veridex" }] }),
  component: SearchPage,
});

const SUGGESTED_PROMPTS = [
  "Can customer data be transferred outside Sierra Leone?",
  "What laws govern cross-border e-commerce?",
  "Are SMEs required to store user data locally?",
  "What are the customs duties on imported electronics?",
];

type RagResult = Awaited<ReturnType<typeof ragAnswer>>;

function SearchPage() {
  const qc = useQueryClient();
  const runRag = useServerFn(ragAnswer);
  const [q, setQ] = useState("");
  const [jurisdiction, setJurisdiction] = useState<string>("");
  const [sourceType, setSourceType] = useState<string>("");
  const [result, setResult] = useState<RagResult | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);

  const { data: history } = useQuery({
    queryKey: ["search-history"],
    queryFn: async () => {
      const { data } = await supabase
        .from("searches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const answer = useMutation({
    mutationFn: async (query: string) => {
      const res = await runRag({
        data: {
          query,
          filters: {
            jurisdiction: jurisdiction || null,
            sourceType: (sourceType || null) as SourceType | null,
          },
        },
      });
      return res;
    },
    onSuccess: (res) => {
      setResult(res);
      setWhyOpen(false);
      qc.invalidateQueries({ queryKey: ["search-history"] });
    },
  });

  function submit(text?: string) {
    const query = (text ?? q).trim();
    if (!query) return;
    setQ(query);
    answer.mutate(query);
  }

  const insufficient =
    !!result &&
    (!result.hasEvidence ||
      result.answer.startsWith("Insufficient verified evidence"));

  return (
    <div>
      <PageHeader
        eyebrow="Evidence-first intelligence"
        title="Ask Veridex"
        description="Natural-language questions answered from indexed regulations and your documents. Every claim is traceable to a verified source."
      />

      <Card className="p-5 mb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. What data localization rules apply to fintechs in this jurisdiction?"
              className="pl-10 h-11"
            />
          </div>
          <Button type="submit" disabled={answer.isPending} className="h-11 px-5">
            {answer.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Ask
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border/60">
          <FilterIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">
            Filters
          </span>
          <Input
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            placeholder="Jurisdiction (e.g. EU, Sierra Leone)"
            className="h-8 w-56 text-sm"
          />
          <Select value={sourceType} onValueChange={(v) => setSourceType(v === "any" ? "" : v)}>
            <SelectTrigger className="h-8 w-56 text-sm">
              <SelectValue placeholder="Source authority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any source</SelectItem>
              {(Object.keys(SOURCE_TYPE_LABELS) as SourceType[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {SOURCE_TYPE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(jurisdiction || sourceType) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setJurisdiction("");
                setSourceType("");
              }}
            >
              Clear
            </Button>
          )}
        </div>

        {!result && !answer.isPending && (
          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => submit(p)}
                className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70 text-foreground/80 border border-border/60 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          {answer.isError && (
            <Card className="p-5 border-destructive/40 bg-destructive/5">
              <p className="text-sm text-destructive">
                {(answer.error as Error).message}
              </p>
            </Card>
          )}

          {answer.isPending && (
            <Card className="p-8 flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-sm">Retrieving evidence and generating answer…</p>
            </Card>
          )}

          {!answer.isPending && result && (
            <>
              <Card className="p-6 border-foreground/10">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    AI answer · evidence-first
                  </span>
                  {!insufficient && (
                    <ConfidenceIndicator score={result.confidence} />
                  )}
                </div>

                {insufficient ? (
                  <div className="flex items-start gap-3 p-4 rounded-md bg-muted border border-border/60">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium">
                        Insufficient verified evidence
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        The current document set does not contain enough indexed
                        material to answer this. Upload more regulations or refine
                        your query.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-serif text-xl leading-relaxed text-foreground whitespace-pre-wrap">
                      {result.answer}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-border/60">
                      {result.sourceAuthority && (
                        <AuthorityBadge sourceType={result.sourceAuthority as SourceType} />
                      )}
                      {result.jurisdictions.map((j) => (
                        <Badge key={j} variant="outline" className="font-normal text-[10px]">
                          {j}
                        </Badge>
                      ))}
                      <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
                        {result.retrievedChunks.length} sources · {result.totalLatencyMs}ms
                      </span>
                    </div>

                    {result.confidence < 0.5 && (
                      <div className="mt-3 flex items-start gap-2 p-3 rounded-md bg-muted/50 border border-border/60">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                        <p className="text-xs text-muted-foreground">
                          Low-confidence answer. Verify the cited sources manually
                          before relying on this for compliance decisions.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </Card>

              {result.retrievedChunks.length > 0 && (
                <Card className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setWhyOpen((v) => !v)}
                    className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                  >
                    <div className="text-left">
                      <p className="font-serif text-base">Why this answer?</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {result.retrievedChunks.length} retrieved clauses, ranked by
                        semantic relevance to your query.
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        whyOpen && "rotate-180",
                      )}
                    />
                  </button>
                  {whyOpen && (
                    <div className="p-4 pt-0 space-y-2 border-t border-border/60">
                      <p className="text-xs text-muted-foreground py-3">
                        Each excerpt below was retrieved via vector similarity
                        against your query embedding. Higher-authority sources are
                        weighted more heavily in the confidence score.
                      </p>
                      {result.retrievedChunks.map((c, i) => (
                        <CitationCard key={c.id} chunk={c} index={i + 1} />
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {result.retrievedChunks.length > 0 && !whyOpen && (
                <div className="space-y-3">
                  <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Verified citations
                  </h2>
                  {result.retrievedChunks.slice(0, 6).map((c, i) => (
                    <CitationCard key={c.id} chunk={c} index={i + 1} />
                  ))}
                </div>
              )}
            </>
          )}

          {!answer.isPending && !result && (
            <EmptyState
              icon={SearchIcon}
              title="Ask an evidence-based question"
              description="Veridex retrieves clauses from indexed regulations and your uploads. Every answer cites its source."
            />
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
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
                      className="text-sm text-foreground/80 hover:text-foreground text-left w-full truncate"
                      onClick={() => submit(s.query)}
                    >
                      {s.query}{" "}
                      <span className="text-muted-foreground text-xs">
                        · {s.result_count}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5 bg-muted/30">
            <h3 className="font-serif text-base mb-2">Evidence-first principles</h3>
            <ul className="text-xs text-muted-foreground space-y-2 leading-relaxed">
              <li>Answers come only from retrieved evidence.</li>
              <li>Higher-authority sources are weighted first.</li>
              <li>Insufficient evidence is acknowledged, never fabricated.</li>
              <li>Every citation is traceable to an indexed clause.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}