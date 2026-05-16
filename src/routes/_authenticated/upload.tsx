import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload as UploadIcon, FileText, Trash2, Loader2, Sparkles } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { processDocument } from "@/lib/ingestion.functions";
import { SOURCE_TYPE_LABELS, type SourceType } from "@/lib/source-authority";
import { AuthorityBadge } from "@/components/authority-badge";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({ meta: [{ title: "Upload — Veridex" }] }),
  component: UploadPage,
});

const docSchema = z.object({
  title: z.string().min(1, "Title required").max(200),
  description: z.string().max(2000).optional(),
  jurisdiction: z.string().max(80).optional(),
  content_text: z.string().max(500_000).optional(),
});

function UploadPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const runProcess = useServerFn(processDocument);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [contentText, setContentText] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("unofficial_source");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: docs, isLoading } = useQuery({
    queryKey: ["my-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file || !user) throw new Error("Select a file");
      const parsed = docSchema.safeParse({ title, description, jurisdiction, content_text: contentText });
      if (!parsed.success) {
        const fe: Record<string, string> = {};
        parsed.error.issues.forEach((i) => { fe[i.path[0] as string] = i.message; });
        setErrors(fe);
        throw new Error("Validation failed");
      }
      setErrors({});
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
      if (upErr) throw upErr;
      const { data: inserted, error: insErr } = await (supabase as any)
        .from("documents")
        .insert({
          owner_id: user.id,
          title,
          description: description || null,
          jurisdiction: jurisdiction || null,
          storage_path: path,
          file_size: file.size,
          mime_type: file.type,
          status: contentText.trim() ? "processing" : "ready",
          content_text: contentText || null,
          source_type: sourceType,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      // Auto-trigger ingestion when text content was provided
      if (contentText.trim() && inserted?.id) {
        try {
          const res = await runProcess({ data: { documentId: inserted.id } });
          toast.success(`Indexed ${res.chunks} chunks for semantic search`);
        } catch (e) {
          toast.error(`Indexing failed: ${(e as Error).message}`);
        }
      }
    },
    onSuccess: () => {
      toast.success("Document uploaded");
      setFile(null);
      setTitle("");
      setDescription("");
      setJurisdiction("");
      setContentText("");
      setSourceType("unofficial_source");
      qc.invalidateQueries({ queryKey: ["my-documents"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: Error) => { if (e.message !== "Validation failed") toast.error(e.message); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const doc = docs?.find((d) => d.id === id);
      if (doc) await supabase.storage.from("documents").remove([doc.storage_path]);
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document deleted");
      qc.invalidateQueries({ queryKey: ["my-documents"] });
    },
  });

  const reindex = useMutation({
    mutationFn: async (id: string) => {
      const res = await runProcess({ data: { documentId: id } });
      return res;
    },
    onSuccess: (r) => {
      toast.success(`Re-indexed ${r.chunks} chunks`);
      qc.invalidateQueries({ queryKey: ["my-documents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Library"
        title="Upload & index documents"
        description="Upload regulations and filings. Paste extracted text to make them searchable via semantic retrieval."
      />

      <div className="grid lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2 p-6 h-fit">
          <h2 className="font-serif text-2xl mb-4">New document</h2>
          <form onSubmit={(e) => { e.preventDefault(); upload.mutate(); }} className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
            </div>
            <div>
              <Label htmlFor="jurisdiction">Jurisdiction</Label>
              <Input id="jurisdiction" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} placeholder="e.g. EU, US, UK" />
            </div>
            <div>
              <Label htmlFor="source-type">Source authority</Label>
              <Select value={sourceType} onValueChange={(v) => setSourceType(v as SourceType)}>
                <SelectTrigger id="source-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SOURCE_TYPE_LABELS) as SourceType[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {SOURCE_TYPE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div>
              <Label htmlFor="content">
                Indexed content{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  (paste extracted text to enable semantic search)
                </span>
              </Label>
              <Textarea
                id="content"
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                rows={6}
                placeholder="Paste the full text of the regulation, policy, or document here. This will be chunked and embedded for retrieval."
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {contentText.length} chars · {Math.ceil(contentText.length / 900)} estimated chunks
              </p>
            </div>
            <div>
              <Label htmlFor="file">File</Label>
              <Input id="file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
              {file && <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024).toFixed(1)} KB</p>}
            </div>
            <Button type="submit" disabled={upload.isPending} className="w-full">
              {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UploadIcon className="h-4 w-4 mr-2" />}
              Upload {contentText.trim() && "& index"}
            </Button>
          </form>
        </Card>

        <Card className="lg:col-span-3 p-6">
          <h2 className="font-serif text-2xl mb-4">Your documents</h2>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !docs || docs.length === 0 ? (
            <EmptyState icon={FileText} title="No documents yet" description="Use the form to upload your first file." />
          ) : (
            <ul className="divide-y divide-border">
              {docs.map((d) => (
                <li key={d.id} className="py-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{d.title}</p>
                      <Badge
                        variant="outline"
                        className={
                          d.status === "ready"
                            ? "text-[10px] font-normal"
                            : d.status === "processing"
                              ? "text-[10px] font-normal bg-muted"
                              : "text-[10px] font-normal text-destructive border-destructive/40"
                        }
                      >
                        {d.status}
                      </Badge>
                      <AuthorityBadge sourceType={(d as any).source_type ?? "unofficial_source"} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {d.jurisdiction ?? "—"} · {d.mime_type ?? "file"} · {new Date(d.created_at).toLocaleDateString()}
                    </p>
                    {d.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{d.description}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    {(d as any).content_text && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Re-index for semantic search"
                        disabled={reindex.isPending}
                        onClick={() => reindex.mutate(d.id)}
                      >
                        {reindex.isPending && reindex.variables === d.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(d.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
