import { QuickActions } from "@/components/app/QuickActions";
import {
  SORTS,
  WorkbookList,
  sortRows,
  type SortKey,
  type WorkbookRow,
} from "@/components/app/WorkbookList";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "My Workbooks — ExcelAI" };

export default async function Workbooks(props: PageProps<"/workbooks">) {
  const sp = await props.searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 100);
  const sort = (
    typeof sp.sort === "string" && sp.sort in SORTS ? sp.sort : "updated"
  ) as SortKey;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workbooks")
    .select("id, name, file_type, size_bytes, updated_at")
    .order("updated_at", { ascending: false })
    .limit(500);
  const rows = sortRows(
    ((data ?? []) as WorkbookRow[]).filter((r) =>
      r.name.toLowerCase().includes(q.toLowerCase()),
    ),
    sort,
  );
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-semibold tracking-tight">My Workbooks</h1>
      <p className="mt-2 text-neutral-600">
        Everything you&apos;ve created or uploaded. Only you can see these.
      </p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.9fr_1fr]">
        <WorkbookList
          title={q ? `Results for “${q}”` : `All workbooks (${rows.length})`}
          rows={rows}
          q={q}
          sort={sort}
          base="/workbooks"
          error={!!error}
        />
        <QuickActions />
      </div>
    </div>
  );
}
