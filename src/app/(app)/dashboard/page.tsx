import Link from "next/link";
import {
  FileSpreadsheet,
  FileText,
  FolderOpen,
  HardDrive,
  Layers,
} from "lucide-react";
import { QuickActions } from "@/components/app/QuickActions";
import { RowActions } from "@/components/app/RowActions";
import { createClient } from "@/lib/supabase/server";
import { formatBytes, timeAgo } from "@/lib/workbooks/validate";

export const metadata = { title: "Dashboard — ExcelAI" };
type Row = {
  id: string;
  name: string;
  file_type: string;
  size_bytes: number;
  updated_at: string;
};
const SORTS = { updated: "Last updated", name: "Name", size: "Size" } as const;

export default async function Dashboard(props: PageProps<"/dashboard">) {
  const sp = await props.searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 100);
  const sort = (
    typeof sp.sort === "string" && sp.sort in SORTS ? sp.sort : "updated"
  ) as keyof typeof SORTS;

  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("workbooks")
    .select("id, name, file_type, size_bytes, updated_at")
    .order("updated_at", { ascending: false })
    .limit(500);
  const all = (data ?? []) as Row[];
  const rows = all
    .filter((r) => r.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "size"
          ? b.size_bytes - a.size_bytes
          : 0,
    );

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
  const href = (s: string) =>
    `/dashboard?${new URLSearchParams({ ...(q ? { q } : {}), sort: s })}`;

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-semibold tracking-tight">Welcome, {name}</h1>
      <p className="mt-2 max-w-xl text-neutral-600">
        Upload spreadsheets and manage your workbooks. AI features are still in
        development.
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
        <section
          id="workbooks"
          className="scroll-mt-4 rounded-xl border border-neutral-200 p-6"
          aria-labelledby="rw"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="rw" className="text-lg font-semibold">
              {q ? `Results for “${q}”` : "Your workbooks"}
            </h2>
            <nav
              className="flex gap-3 text-xs text-neutral-500"
              aria-label="Sort workbooks"
            >
              {Object.entries(SORTS).map(([k, l]) => (
                <Link
                  key={k}
                  href={href(k)}
                  aria-current={sort === k ? "true" : undefined}
                  className={
                    sort === k
                      ? "font-semibold text-neutral-950 underline"
                      : "hover:text-neutral-950"
                  }
                >
                  {l}
                </Link>
              ))}
            </nav>
          </div>
          {error ? (
            <p
              role="alert"
              className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              Couldn&apos;t load your workbooks. Refresh the page to try again.
              If it keeps happening, check that the database migration has been
              applied.
            </p>
          ) : rows.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-neutral-300 p-10 text-center">
              <FolderOpen className="mx-auto" size={28} />
              <p className="mt-3 font-medium">
                {q ? "No workbooks match your search" : "No workbooks yet"}
              </p>
              <p className="mt-1 text-sm text-neutral-600">
                {q ? (
                  <Link href="/dashboard" className="underline">
                    Clear search
                  </Link>
                ) : (
                  "Upload an XLSX or CSV file, or create a blank workbook."
                )}
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="py-2 font-normal">Name</th>
                    <th className="font-normal">Last updated</th>
                    <th className="font-normal">Size</th>
                    <th className="w-10">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-neutral-100">
                      <td className="py-3">
                        <Link
                          href={`/workspace/${r.id}`}
                          className="flex items-center gap-3 font-medium hover:underline"
                        >
                          {r.file_type === "blank" ? (
                            <FileText size={18} />
                          ) : (
                            <FileSpreadsheet size={18} />
                          )}
                          <span className="truncate">{r.name}</span>
                          <span className="rounded bg-neutral-100 px-1.5 text-[11px] font-normal uppercase text-neutral-600">
                            {r.file_type}
                          </span>
                        </Link>
                      </td>
                      <td className="text-neutral-600">
                        {timeAgo(r.updated_at)}
                      </td>
                      <td className="text-neutral-600">
                        {r.file_type === "blank"
                          ? "—"
                          : formatBytes(r.size_bytes)}
                      </td>
                      <td>
                        <RowActions id={r.id} name={r.name} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <QuickActions />
      </div>
    </div>
  );
}
