import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Shield, Loader2, UserCog, Database as DatabaseIcon, Activity, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { RoleBadge } from "@/components/role-badge";
import { getDebugStats } from "@/lib/admin-debug.functions";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).eq("role", "admin").maybeSingle();
    if (!data) throw redirect({ to: "/dashboard" });
  },
  head: () => ({ meta: [{ title: "Admin — Veridex" }] }),
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();
  const fetchDebug = useServerFn(getDebugStats);

  const { data: debug } = useQuery({
    queryKey: ["admin-debug"],
    queryFn: () => fetchDebug(),
    refetchInterval: 15_000,
  });

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data: ps, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const ids = ps.map((p) => p.id);
      const { data: rs } = await supabase.from("user_roles").select("user_id, role").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const byUser = new Map<string, AppRole[]>();
      (rs ?? []).forEach((r) => {
        const list = byUser.get(r.user_id) ?? [];
        list.push(r.role as AppRole);
        byUser.set(r.user_id, list);
      });
      return ps.map((p) => ({ ...p, roles: byUser.get(p.id) ?? [] }));
    },
  });

  const { data: docCount } = useQuery({
    queryKey: ["admin-doc-count"],
    queryFn: async () => (await supabase.from("documents").select("id", { count: "exact", head: true })).count ?? 0,
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Admin Panel" description="Manage users, roles and platform-wide settings." />

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card className="p-5">
          <UserCog className="h-4 w-4 text-muted-foreground" />
          <p className="mt-4 font-serif text-4xl">{profiles?.length ?? 0}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mt-1">Total users</p>
        </Card>
        <Card className="p-5">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <p className="mt-4 font-serif text-4xl">{profiles?.filter((p) => p.roles.includes("admin")).length ?? 0}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mt-1">Admins</p>
        </Card>
        <Card className="p-5">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <p className="mt-4 font-serif text-4xl">{docCount ?? 0}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mt-1">Documents</p>
        </Card>
        <Card className="p-5">
          <DatabaseIcon className="h-4 w-4 text-muted-foreground" />
          <p className="mt-4 font-serif text-4xl">{debug?.totalChunks ?? 0}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mt-1">Indexed chunks</p>
        </Card>
        <Card className="p-5">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <p className="mt-4 font-serif text-4xl tabular-nums">
            {debug?.avgRetrievalMs ?? 0}
            <span className="text-base text-muted-foreground ml-1">ms</span>
          </p>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mt-1">
            Avg retrieval · AI {debug?.avgAiMs ?? 0}ms
          </p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-serif text-xl">Recent retrieval logs</h2>
          </div>
          {!debug?.recentLogs?.length ? (
            <p className="text-sm text-muted-foreground">No RAG queries yet.</p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {debug.recentLogs.map((l: any) => (
                <li key={l.id} className="text-xs border-b border-border/40 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate flex-1">{l.query}</p>
                    <span
                      className={
                        l.status === "ok"
                          ? "text-[10px] text-foreground"
                          : "text-[10px] text-muted-foreground"
                      }
                    >
                      {l.status}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 tabular-nums">
                    {l.retrieval_count} chunks · top sim {Number(l.top_similarity ?? 0).toFixed(2)} · {l.retrieval_latency_ms}ms retrieval · {l.ai_latency_ms}ms AI
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-serif text-xl">Failed documents</h2>
          </div>
          {!debug?.failedDocuments?.length ? (
            <p className="text-sm text-muted-foreground">No ingestion failures.</p>
          ) : (
            <ul className="space-y-2">
              {debug.failedDocuments.map((d) => (
                <li key={d.id} className="text-sm">
                  <p className="truncate">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Failed {new Date(d.updated_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-serif text-2xl mb-4">Users & roles</h2>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !profiles || profiles.length === 0 ? (
          <EmptyState icon={UserCog} title="No users yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Current role</TableHead>
                <TableHead className="text-right">Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <p className="font-medium">{p.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{p.email}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.organization ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {p.roles.length === 0 ? <span className="text-xs text-muted-foreground">none</span> : p.roles.map((r) => <RoleBadge key={r} role={r} />)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Select onValueChange={(v) => setRole.mutate({ userId: p.id, role: v as AppRole })}>
                      <SelectTrigger className="w-[140px] ml-auto"><SelectValue placeholder="Set role" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="analyst">Analyst</SelectItem>
                        <SelectItem value="sme_user">SME User</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
