import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  if (!getSupabaseEnv()) redirect("/sign-in?error=config");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/sign-in?error=session_expired");
  return <AppShell email={data.user.email ?? "Account"}>{children}</AppShell>;
}
