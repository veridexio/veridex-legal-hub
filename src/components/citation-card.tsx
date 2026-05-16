import { useState } from "react";
import { ChevronDown, FileText, MapPin, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AuthorityBadge } from "./authority-badge";
import { cn } from "@/lib/utils";
import type { RetrievedChunk } from "@/lib/rag-search.functions";

export function CitationCard({
  chunk,
  index,
}: {
  chunk: RetrievedChunk;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const pct = Math.round(chunk.similarity * 100);
  return (
    <Card className="overflow-hidden border-border/80 bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left p-5 flex flex-col gap-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-[10px] text-muted-foreground tabular-nums px-1.5 py-0.5 bg-muted rounded">
              [{index}]
            </span>
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <h3 className="font-serif text-base truncate">{chunk.title}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {pct}% match
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AuthorityBadge sourceType={chunk.sourceType} />
          {chunk.jurisdiction && (
            <Badge variant="outline" className="gap-1 font-normal text-[10px]">
              <MapPin className="h-3 w-3" />
              {chunk.jurisdiction}
            </Badge>
          )}
          {chunk.section && (
            <Badge variant="outline" className="font-normal text-[10px]">
              {chunk.section}
            </Badge>
          )}
          {chunk.pageNumber != null && (
            <Badge variant="outline" className="font-normal text-[10px]">
              p. {chunk.pageNumber}
            </Badge>
          )}
          <Badge variant="outline" className="gap-1 font-normal text-[10px] ml-auto">
            <CheckCircle2 className="h-3 w-3" />
            Verified excerpt
          </Badge>
        </div>

        <p
          className={cn(
            "text-sm text-foreground/80 leading-relaxed",
            !open && "line-clamp-2",
          )}
        >
          {chunk.content}
        </p>
      </button>
    </Card>
  );
}