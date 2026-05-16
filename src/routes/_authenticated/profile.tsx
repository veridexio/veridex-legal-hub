import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/role-badge";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — Veridex" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setOrganization(profile.organization ?? "");
    }
  }, [profile]);

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({
        full_name: fullName, organization,
      }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader eyebrow="Account" title="Profile settings" description="Manage your personal details and view assigned roles." />
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 p-6">
            <h2 className="font-serif text-2xl mb-4">Personal details</h2>
            <form onSubmit={(e) => { e.preventDefault(); update.mutate(); }} className="space-y-4">
              <div><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
              <div><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div><Label>Organization</Label><Input value={organization} onChange={(e) => setOrganization(e.target.value)} /></div>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save changes
              </Button>
            </form>
          </Card>
          <Card className="p-6 h-fit">
            <h2 className="font-serif text-2xl mb-4">Assigned roles</h2>
            <div className="flex flex-wrap gap-2">
              {roles.length === 0 ? <p className="text-sm text-muted-foreground">No roles assigned.</p> :
                roles.map((r) => <RoleBadge key={r} role={r} />)}
            </div>
            <p className="text-xs text-muted-foreground mt-4 border-t border-border pt-4">
              Contact an admin to request elevated permissions.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
