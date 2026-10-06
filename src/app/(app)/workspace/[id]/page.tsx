import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import WorkspaceLoader from "@/components/workspace/WorkspaceLoader";
import { createClient } from "@/lib/supabase/server";
import { ensureSnapshot, type WorkbookRow } from "@/lib/workbooks/load";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const metadata = { title: "Workspace — ExcelAI" };

export default async function Workspace(props: PageProps<"/workspace/[id]">) {
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  // Row Level Security returns nothing for workbooks the user doesn't own.
  const { data, error } = await supabase
    .from("workbooks")
    .select("id, name, file_type, storage_path, snapshot, snapshot_version")
    .eq("id", id)
    .maybeSingle();
  if (!error && !data) notFound();

  const failure = error
    ? "Couldn't load this workbook. If you haven't yet, run the latest database migration (supabase/migrations/20261004000000_workbook_snapshot.sql)."
    : null;
  const opened =
    !failure && data
      ? await ensureSnapshot(supabase, data as WorkbookRow)
      : null;
  const message =
    failure ?? (opened && "error" in opened ? opened.error : null);

  if (message || !opened || "error" in opened || !data) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm hover:underline"
        >
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
        <p
          role="alert"
          className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {message ?? "Couldn't open this workbook."}
        </p>
      </div>
    );
  }
  return (
    <WorkspaceLoader
      id={data.id}
      name={data.name}
      snapshot={opened.snapshot}
      version={opened.version}
    />
  );
}
