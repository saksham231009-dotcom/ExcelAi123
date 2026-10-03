import Link from "next/link";
import { redirect } from "next/navigation";
import { ResetForm } from "@/components/auth/Forms";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set new password — ExcelAI" };

export default async function Page() {
  if (!getSupabaseEnv()) redirect("/sign-in?error=config");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/forgot-password?error=link_invalid");
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        Set a new password
      </h1>
      <p className="mb-6 mt-1 text-sm text-neutral-600">
        Use at least 8 characters.
      </p>
      <ResetForm />
      <p className="mt-6 text-center text-sm">
        <Link href="/sign-in" className="font-medium underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
