import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatBytes } from "@/lib/workbooks/validate";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Workspace(props: PageProps<"/workspace/[id]">) {
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  // Row Level Security returns nothing for workbooks the user doesn't own.
  const { data: wb } = await supabase
    .from("workbooks")
    .select("id, name, file_type, size_bytes, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!wb) notFound();
  const meta: [string, string][] = [
    [
      "Type",
      wb.file_type === "blank"
        ? "Blank workbook (no file)"
        : wb.file_type.toUpperCase(),
    ],
    ["Size", wb.file_type === "blank" ? "—" : formatBytes(wb.size_bytes)],
    ["Created", new Date(wb.created_at).toUTCString()],
    ["Last updated", new Date(wb.updated_at).toUTCString()],
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm hover:underline"
      >
        <ArrowLeft size={16} /> Back to dashboard
      </Link>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{wb.name}</h1>
      <p
        role="note"
        className="mt-4 rounded-lg border border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-700"
      >
        <strong>Placeholder.</strong> The spreadsheet editor isn&apos;t built
        yet, so this workbook can&apos;t be viewed or edited. This page only
        confirms you own it and shows its details.
      </p>
      <dl className="mt-6 divide-y divide-neutral-200 rounded-xl border border-neutral-200 text-sm">
        {meta.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 p-4">
            <dt className="text-neutral-500">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
