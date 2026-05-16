import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Library, Search, Bookmark, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { RoleBadge } from "@/components/role-badge";
import { useAuth } from "@/hooks/use-auth";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Veridex" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user, roles } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    queryFn: async () => {
      const [docs, regs, saves, searches] = await Promise.all([
        supabase.from("documents").select("id", { count: "exact", head: true }),
        supabase.from("regulations").select("id", { count: "exact", head: true }),
        supabase.from("saved_items").select("id", { count: "exact", head: true }),
        supabase.from("searches").select("id", { count: "exact", head: true }),
      ]);
      return {
        documents: docs.count ?? 0,
        regulations: regs.count ?? 0,
        saved: saves.count ?? 0,
        searches: searches.count ?? 0,
      };
    },
  });

  const { data: recentDocs } = useQuery({
    queryKey: ["recent-docs", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("id, title, jurisdiction, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const tiles = [
    { label: "Documents", value: stats?.documents ?? 0, icon: FileText, to: "/upload" },
    { label: "Regulations", value: stats?.regulations ?? 0, icon: Library, to: "/regulations" },
    { label: "Saved items", value: stats?.saved ?? 0, icon: Bookmark, to: "/saved" },
    { label: "Searches", value: stats?.searches ?? 0, icon: Search, to: "/search" },
  ] as const;

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title={`Welcome, ${user?.email?.split("@")[0] ?? "user"}`}
        description="Your regulatory research at a glance."
        actions={<div className="flex gap-1 items-center">{roles.map((r) => <RoleBadge key={r} role={r} />)}</div>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
        {tiles.map((t) => (
          <Link key={t.label} to={t.to} className="group">
            <Card className="p-5 transition-colors hover:border-primary/40">
              <div className="flex items-center justify-between">
                <t.icon className="h-4 w-4 text-muted-foreground" />
                <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
              </div>
              <p className="mt-6 font-serif text-4xl">{t.value}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.label}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-serif text-2xl">Recent documents</h2>
            <Link to="/upload" className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
              Upload →
            </Link>
          </div>
          {!recentDocs || recentDocs.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents yet"
              description="Upload contracts, filings or policies to begin building your workspace."
            />
          ) : (
            <ul className="divide-y divide-border">
              {recentDocs.map((d) => (
                <li key={d.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{d.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.jurisdiction ?? "—"} · {new Date(d.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                    {d.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-serif text-2xl mb-4">AI capabilities</h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>• Retrieval-augmented citations</li>
            <li>• OCR for scanned documents</li>
            <li>• Multilingual regulation search</li>
            <li>• Citation verification</li>
          </ul>
          <p className="mt-6 text-xs text-muted-foreground border-t border-border pt-4">
            Hooks are in place — wire up to your AI provider when ready.
          </p>
        </Card>
      </div>
    </div>
  );
}
