import { Link } from "@tanstack/react-router";
import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MarketingHeader() {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Scale className="h-4 w-4" />
          </div>
          <span className="font-serif text-xl">Veridex</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#capabilities" className="hover:text-foreground transition-colors">Capabilities</a>
          <a href="#platform" className="hover:text-foreground transition-colors">Platform</a>
          <a href="#trust" className="hover:text-foreground transition-colors">Trust</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild size="sm"><Link to="/auth">Sign in</Link></Button>
          <Button asChild size="sm"><Link to="/auth" search={{ mode: "signup" }}>Get started</Link></Button>
        </div>
      </div>
    </header>
  );
}
