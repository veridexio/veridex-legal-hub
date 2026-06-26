import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Upload as UploadIcon, FileText, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { extractPdfText } from "@/lib/pdf-extract.functions";
import { useLocalDocs } from "@/lib/local-docs";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({ meta: [{ title: "Documents — Veridex" }] }),
  component: UploadPage,
});

const MAX_PDF_BYTES = 10 * 1024 * 1024;

function UploadPage() {
  const runExtract = useServerFn(extractPdfText);
  const { docs, addDoc, removeDoc } = useLocalDocs();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function onFile(f: File | null) {
    if (!f) return;
    if (f.type !== "application/pdf") {
      toast.error("Please upload a PDF");
      return;
    }
    if (f.size > MAX_PDF_BYTES) {
      toast.error("PDF exceeds 10 MB");
      return;
    }
    setBusy(true);
    try {
      const buf = await f.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      }
      const res = await runExtract({
        data: { fileBase64: btoa(bin), filename: f.name },
      });
      setText(res.text);
      if (!title) setTitle(f.name.replace(/\.pdf$/i, ""));
      toast.success(`Extracted ${res.pageCount} pages`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!title.trim() || !text.trim()) {
      toast.error("Add a title and content");
      return;
    }
    addDoc({ title: title.trim(), text: text.trim() });
    toast.success("Document saved — ask Veridex about it in chat");
    setTitle("");
    setText("");
  }

  return (
    <div>
      <PageHeader
        eyebrow="Knowledge"
        title="Your documents"
        description="Upload a PDF or paste text. Veridex will use these as context when you chat."
      />

      <div className="grid lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2 p-6 h-fit">
          <h2 className="font-serif text-2xl mb-4">Add document</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="file">PDF (optional)</Label>
              <Input
                id="file"
                type="file"
                accept="application/pdf"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
              {busy && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Extracting…
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="text">Content</Label>
              <Textarea
                id="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                placeholder="Paste regulation text, or upload a PDF above to auto-fill."
                required
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {text.length.toLocaleString()} chars
              </p>
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              <UploadIcon className="h-4 w-4 mr-2" /> Save document
            </Button>
          </form>
        </Card>

        <Card className="lg:col-span-3 p-6">
          <h2 className="font-serif text-2xl mb-4">Saved documents</h2>
          {docs.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents yet"
              description="Add a PDF or paste text to give Veridex context for your questions."
            />
          ) : (
            <ul className="divide-y divide-border">
              {docs.map((d) => (
                <li
                  key={d.id}
                  className="py-4 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{d.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {d.text.length.toLocaleString()} chars ·{" "}
                      {new Date(d.addedAt).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {d.text.slice(0, 220)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeDoc(d.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}