import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const labels: Record<AppRole, string> = {
  admin: "Admin",
  analyst: "Analyst",
  sme_user: "SME User",
  viewer: "Viewer",
};

const styles: Record<AppRole, string> = {
  admin: "bg-primary text-primary-foreground",
  analyst: "bg-accent text-accent-foreground border border-border",
  sme_user: "bg-secondary text-secondary-foreground",
  viewer: "bg-muted text-muted-foreground",
};

export function RoleBadge({ role }: { role: AppRole }) {
  return <Badge className={`${styles[role]} font-medium uppercase tracking-wide text-[10px]`}>{labels[role]}</Badge>;
}
