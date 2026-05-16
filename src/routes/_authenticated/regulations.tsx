import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Library, Plus, Bookmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/regulations")({
  head: () => ({ meta: [{ title: "Regulations — Veridex" }] }),
  component: RegulationsPage,
});

function RegulationsPage() {
  const { user, hasRole, isAdmin } = useAuth();
  const canCreate = isAdmin || hasRole("analyst") || hasRole("sme_user");
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [jur, setJur] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", jurisdiction: "", authority: "", category: "", summary: "" });

  const { data: regs, isLoading } = useQuery({
    queryKey: ["regulations", q, jur],
    queryFn: async () => {
      let query = supabase.from("regulations").select("*").order("created_at", { ascending: false });
      if (q) query = query.ilike("title", `%${q}%`);
      if (jur) query = query.ilike("jurisdiction", `%${jur}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title || !form.jurisdiction) throw new Error("Title and jurisdiction required");
      const { error } = await supabase.from("regulations").insert({
        ...form, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Regulation added");
      setOpen(false);
      setForm({ title: "", jurisdiction: "", authority: "", category: "", summary: "" });
      qc.invalidateQueries({ queryKey: ["regulations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_items").insert({
        user_id: user!.id, item_type: "regulation", item_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Saved to your library"),
    onError: (e: any) => toast.error(e.message?.includes("duplicate") ? "Already saved" : e.message),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Knowledge base"
        title="Regulations Library"
        description="Searchable catalog of official trade regulations and statutory references."
        actions={canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add regulation</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New regulation entry</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Jurisdiction *</Label><Input value={form.jurisdiction} onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })} /></div>
                  <div><Label>Authority</Label><Input value={form.authority} onChange={(e) => setForm({ ...form, authority: e.target.value })} /></div>
                </div>
                <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
                <div><Label>Summary</Label><Textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={4} /></div>
                <Button onClick={() => create.mutate()} disabled={create.isPending} className="w-full">
                  {create.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      />

      <Card className="p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search by title..." value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 min-w-[200px]" />
          <Input placeholder="Jurisdiction filter" value={jur} onChange={(e) => setJur(e.target.value)} className="w-48" />
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !regs || regs.length === 0 ? (
        <EmptyState icon={Library} title="No regulations yet" description={canCreate ? "Add the first entry to populate the library." : "Check back soon — analysts are curating this library."} />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {regs.map((r) => (
            <Card key={r.id} className="p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-2">
                <Badge variant="outline" className="uppercase text-[10px] tracking-wide">{r.jurisdiction}</Badge>
                <Button variant="ghost" size="icon" onClick={() => save.mutate(r.id)}>
                  <Bookmark className="h-4 w-4" />
                </Button>
              </div>
              <h3 className="font-serif text-xl leading-tight">{r.title}</h3>
              {r.authority && <p className="text-xs text-muted-foreground mt-1">{r.authority}</p>}
              {r.summary && <p className="text-sm text-muted-foreground mt-3 line-clamp-3">{r.summary}</p>}
              {r.category && <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-4 pt-3 border-t border-border">{r.category}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
