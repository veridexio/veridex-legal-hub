import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/saved")({
  head: () => ({ meta: [{ title: "Saved — Veridex" }] }),
  component: SavedPage,
});

function SavedPage() {
  const qc = useQueryClient();
  const { data: items, isLoading } = useQuery({
    queryKey: ["saved-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("saved_items").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["saved-items"] });
    },
  });

  return (
    <div>
      <PageHeader eyebrow="Library" title="Saved items" description="Bookmarked regulations, documents and citations." />
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !items || items.length === 0 ? (
        <EmptyState icon={Bookmark} title="Nothing saved yet" description="Bookmark items from the Regulations library." />
      ) : (
        <Card className="p-6">
          <ul className="divide-y divide-border">
            {items.map((i) => (
              <li key={i.id} className="py-4 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="uppercase text-[10px] tracking-wide">{i.item_type}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(i.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm font-mono mt-1 text-muted-foreground">{i.item_id}</p>
                  {i.note && <p className="text-sm mt-1">{i.note}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove.mutate(i.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
