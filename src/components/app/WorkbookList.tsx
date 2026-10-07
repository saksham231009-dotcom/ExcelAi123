import Link from "next/link";
import { FileSpreadsheet, FileText, FolderOpen } from "lucide-react";
import { RowActions } from "@/components/app/RowActions";
import { formatBytes, timeAgo } from "@/lib/workbooks/validate";

export type WorkbookRow = {
  id: string;
  name: string;
  file_type: string;
  size_bytes: number;
  updated_at: string;
};
export const SORTS = {
  updated: "Last updated",
  name: "Name",
  size: "Size",
} as const;
export type SortKey = keyof typeof SORTS;

export function sortRows(rows: WorkbookRow[], sort: SortKey) {
  return [...rows].sort((a, b) =>
    sort === "name"
      ? a.name.localeCompare(b.name)
      : sort === "size"
        ? b.size_bytes - a.size_bytes
        : +new Date(b.updated_at) - +new Date(a.updated_at),
  );
}

export function WorkbookList({
  title,
  rows,
  q,
  sort,
  base,
  error,
  viewAll,
  showSort = true,
}: {
  title: string;
  rows: WorkbookRow[];
  q: string;
  sort: SortKey;
  base: string;
  error: boolean;
  viewAll?: boolean;
  showSort?: boolean;
}) {
  const href = (s: string) =>
    `${base}?${new URLSearchParams({ ...(q ? { q } : {}), sort: s })}`;
  return (
    <section
      id="workbooks"
      className="scroll-mt-4 rounded-xl border border-neutral-200 p-6"
      aria-labelledby="wl-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="wl-title" className="text-lg font-semibold">
          {title}
        </h2>
        {showSort && (
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
        )}
        {viewAll && (
          <Link
            href="/workbooks"
            className="text-sm text-neutral-600 hover:text-neutral-950"
          >
            View all →
          </Link>
        )}
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          Couldn&apos;t load your workbooks. Refresh to try again. If it keeps
          happening, check that all database migrations were applied (
          <code>npm run check</code>).
        </p>
      ) : rows.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-neutral-300 p-10 text-center">
          <FolderOpen className="mx-auto" size={28} />
          <p className="mt-3 font-medium">
            {q
              ? "No workbooks match your search"
              : "Create your first workbook"}
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            {q ? (
              <Link href={base} className="underline">
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
                  <td className="text-neutral-600">{timeAgo(r.updated_at)}</td>
                  <td className="text-neutral-600">
                    {r.file_type === "blank" ? "—" : formatBytes(r.size_bytes)}
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
  );
}
