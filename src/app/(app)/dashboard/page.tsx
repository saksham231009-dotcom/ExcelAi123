import { FileSpreadsheet, HardDrive, Layers } from "lucide-react";
import { QuickActions } from "@/components/app/QuickActions";
import {
  WorkbookList,
  sortRows,
  type WorkbookRow,
} from "@/components/app/WorkbookList";
import { createClient } from "@/lib/supabase/server";
import { formatBytes } from "@/lib/workbooks/validate";

export const metadata = { title: "Dashboard — ExcelAI" };

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("workbooks")
    .select("id, name, file_type, size_bytes, updated_at")
    .order("updated_at", { ascending: false })
    .limit(500);
  const all = (data ?? []) as WorkbookRow[];
  const name = (user.user?.email ?? "").split("@")[0];
  const stats = [
    { icon: Layers, label: "Total workbooks", value: String(all.length) },
    {
      icon: FileSpreadsheet,
      label: "Uploaded files",
      value: String(all.filter((r) => r.file_type !== "blank").length),
    },
    {
      icon: HardDrive,
      label: "Storage used",
      value: formatBytes(all.reduce((s, r) => s + r.size_bytes, 0)),
    },
  ];
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-semibold tracking-tight">Welcome, {name}</h1>
      <p className="mt-2 max-w-xl text-neutral-600">
        Upload spreadsheets, open them in the workspace and ask the AI assistant
        to work on your data.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {stats.map(({ icon: I, label, value }) => (
          <div key={label} className="rounded-xl border border-neutral-200 p-5">
            <I size={22} />
            <p className="mt-4 text-sm">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.9fr_1fr]">
        <WorkbookList
          title="Recent workbooks"
          rows={sortRows(all, "updated").slice(0, 5)}
          q=""
          sort="updated"
          base="/dashboard"
          error={!!error}
          viewAll
          showSort={false}
        />
        <QuickActions />
      </div>
    </div>
  );
}
