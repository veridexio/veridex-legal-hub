import { Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  authorityTier,
  SOURCE_TYPE_LABELS,
  type SourceType,
} from "@/lib/source-authority";

export function AuthorityBadge({
  sourceType,
  className,
}: {
  sourceType: SourceType | null | undefined;
  className?: string;
}) {
  const tier = authorityTier(sourceType);
  const label = SOURCE_TYPE_LABELS[(sourceType ?? "unofficial_source") as SourceType];
  const Icon =
    tier === "high" ? ShieldCheck : tier === "medium" ? Shield : ShieldAlert;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 font-normal border-border",
        tier === "high" && "bg-foreground/5 text-foreground border-foreground/20",
        tier === "medium" && "bg-muted text-foreground/80",
        tier === "low" && "bg-muted/40 text-muted-foreground",
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      <span className="text-[10px] uppercase tracking-wider">{label}</span>
    </Badge>
  );
}