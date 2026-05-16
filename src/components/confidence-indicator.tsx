import { classifyConfidence } from "@/lib/source-authority";
import { cn } from "@/lib/utils";

export function ConfidenceIndicator({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const tier = classifyConfidence(score);
  const pct = Math.round(score * 100);
  const color =
    tier === "high"
      ? "bg-foreground"
      : tier === "medium"
        ? "bg-foreground/60"
        : "bg-muted-foreground/50";
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full transition-all", color)} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {tier} confidence
        </span>
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}