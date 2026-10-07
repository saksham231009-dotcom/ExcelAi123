import Link from "next/link";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatBytes } from "@/lib/workbooks/validate";

export const metadata = { title: "Billing & Plan — ExcelAI" };

export default async function Billing() {
  const supabase = await createClient();
  const { data } = await supabase.from("workbooks").select("size_bytes");
  const count = data?.length ?? 0;
  const bytes = (data ?? []).reduce((s, r) => s + (r.size_bytes ?? 0), 0);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        Billing &amp; Plan
      </h1>
      <section className="rounded-xl border border-neutral-200 p-6">
        <p className="text-sm text-neutral-500">Current plan</p>
        <p className="mt-1 text-xl font-semibold">Development account</p>
        <p className="mt-2 text-sm text-neutral-600">
          Billing isn&apos;t enabled yet, so you aren&apos;t being charged and
          no payment details are stored. Your usage so far: {count} workbook
          {count === 1 ? "" : "s"}, {formatBytes(bytes)} stored.
        </p>
      </section>
      <section className="rounded-xl border border-neutral-200 p-6">
        <h2 className="font-semibold">ExcelAI Pro</h2>
        <p className="mt-2">
          <span className="text-4xl font-semibold tracking-tight">$10</span>
          <span className="text-neutral-500">/month</span>
        </p>
        <ul className="mt-5 space-y-2 text-sm text-neutral-700">
          {[
            "Editable spreadsheet workspace",
            "AI assistant that edits your real sheet",
            "XLSX and CSV upload, XLSX export",
          ].map((t) => (
            <li key={t} className="flex gap-2.5">
              <Check size={16} className="mt-0.5 shrink-0" />
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-5 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600">
          This price is shown for transparency only. Subscription checkout will
          be added before paid use. See the{" "}
          <Link href="/terms" className="underline">
            Terms of Service
          </Link>{" "}
          (draft).
        </p>
      </section>
    </div>
  );
}
