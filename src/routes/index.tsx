import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, FileSearch, Globe2, Layers, BadgeCheck, BookMarked } from "lucide-react";
import { MarketingHeader } from "@/components/marketing-header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Veridex — Trade & Regulatory Intelligence" },
      { name: "description", content: "Veridex helps trade compliance teams find, organize and understand official legal and regulatory documents with AI-assisted citation verification." },
    ],
  }),
  component: Landing,
});

const capabilities = [
  { icon: FileSearch, title: "Verified citation search", body: "Retrieve passages from official regulations with full provenance, page references and source authority." },
  { icon: Globe2, title: "Multilingual coverage", body: "Search across jurisdictions and languages with normalized references and translated summaries." },
  { icon: Layers, title: "Document workspace", body: "Upload internal policies, contracts and filings. Organize with tags, jurisdiction and status." },
  { icon: BadgeCheck, title: "AI-ready foundation", body: "Pluggable hooks for RAG, OCR and citation verification — built on a typed, role-aware schema." },
  { icon: ShieldCheck, title: "Role-based access", body: "Admin, Analyst, SME and Viewer roles with strict row-level security on every record." },
  { icon: BookMarked, title: "Saved research", body: "Bookmark regulations, citations and documents. Audit trail captures every action." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader />

      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-24 md:py-32 grid md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-7">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground mb-5">
              Trade & Regulatory Intelligence
            </p>
            <h1 className="font-serif text-5xl md:text-7xl leading-[1.02] text-foreground">
              Trustworthy answers from official sources.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Veridex unifies global trade regulations and your internal documents into one
              searchable workspace — with verifiable citations, jurisdictional context, and
              AI assistance designed for legal-grade accuracy.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Request access <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">Sign in</Link>
              </Button>
            </div>
          </div>
          <div className="md:col-span-5">
            <div className="relative rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Citation preview</p>
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-success">Verified</span>
              </div>
              <p className="font-serif text-lg leading-snug text-foreground">
                "No customs duties shall be levied on goods originating in either Party which are imported into the territory of the other Party."
              </p>
              <div className="mt-5 space-y-1 text-xs text-muted-foreground">
                <p><span className="text-foreground font-medium">Source.</span> EU–UK Trade and Cooperation Agreement</p>
                <p><span className="text-foreground font-medium">Article.</span> GOODS.5 · Page 42</p>
                <p><span className="text-foreground font-medium">Jurisdiction.</span> EU / UK</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section id="capabilities" className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="max-w-2xl mb-14">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground mb-3">Platform</p>
            <h2 className="font-serif text-4xl md:text-5xl">Built for compliance teams who can't afford to be wrong.</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-lg overflow-hidden border border-border">
            {capabilities.map((c) => (
              <div key={c.title} className="bg-card p-8">
                <c.icon className="h-5 w-5 text-muted-foreground" />
                <h3 className="mt-5 font-serif text-2xl">{c.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section id="trust" className="border-b border-border bg-secondary/30">
        <div className="mx-auto max-w-7xl px-6 py-20 grid md:grid-cols-3 gap-10">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Provenance</p>
            <p className="mt-3 font-serif text-2xl">Every passage links to its source.</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Security</p>
            <p className="mt-3 font-serif text-2xl">Row-level access. Full audit trail.</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Scalable</p>
            <p className="mt-3 font-serif text-2xl">Designed for teams and AI workflows.</p>
          </div>
        </div>
      </section>

      <footer className="bg-background">
        <div className="mx-auto max-w-7xl px-6 py-10 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Veridex. All rights reserved.</p>
          <p>A foundation for AI-assisted regulatory research.</p>
        </div>
      </footer>
    </div>
  );
}
