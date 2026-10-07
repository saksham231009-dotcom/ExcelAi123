import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/(auth)/actions";
import { ChangePasswordForm } from "@/components/auth/Forms";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Settings — ExcelAI" };

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-neutral-200 p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function Settings() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect("/sign-in?error=session_expired");
  const rows: [string, string][] = [
    ["Email", user.email ?? "—"],
    ["Email status", user.email_confirmed_at ? "Verified" : "Not verified"],
    [
      "Member since",
      new Date(user.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      }),
    ],
  ];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <Section title="Account">
        <dl className="divide-y divide-neutral-100 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2.5">
              <dt className="text-neutral-500">{k}</dt>
              <dd className="truncate">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section title="Security">
        <p className="mb-4 text-sm text-neutral-600">
          Choose a new password (at least 8 characters). Forgot your current
          one? Sign out and use “Forgot password” on the sign-in page.
        </p>
        <ChangePasswordForm />
      </Section>
      <Section title="Data and AI">
        <p className="text-sm leading-relaxed text-neutral-600">
          Your workbooks are private to your account. When you use the AI
          assistant, only your request, sheet names, column headers and a few
          sample rows are sent to the AI provider, never the whole workbook. See
          the{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>{" "}
          (draft) and{" "}
          <Link href="/terms" className="underline">
            Terms of Service
          </Link>{" "}
          (draft).
        </p>
      </Section>
      <Section title="Session">
        <form action={signOutAction}>
          <button className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium hover:bg-neutral-50">
            Sign out
          </button>
        </form>
      </Section>
    </div>
  );
}
