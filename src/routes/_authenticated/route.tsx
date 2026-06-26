import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { loading } = useAuth();
  const path = useRouterState({ select: (r) => r.location.pathname });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border bg-background/80 backdrop-blur px-4 sticky top-0 z-30">
            <SidebarTrigger />
            <p className="ml-3 text-xs uppercase tracking-[0.18em] text-muted-foreground hidden sm:block">
              {path.replace("/", "") || "chat"}
            </p>
          </header>
          <main className="flex-1 px-6 py-8 md:px-10 max-w-7xl w-full">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
