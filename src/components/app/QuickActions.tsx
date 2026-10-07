"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, FilePlus, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createBlankWorkbook,
  registerUpload,
} from "@/app/(app)/dashboard/actions";
import {
  BUCKET,
  FILE_TYPES,
  MAX_UPLOAD_BYTES,
  validateUploadFile,
} from "@/lib/workbooks/validate";

const row =
  "flex w-full items-center gap-4 rounded-lg border border-neutral-200 p-3.5 text-left";

export function QuickActions() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, startTransition] = useTransition();
  const [status, setStatus] = useState<{
    kind: "error" | "info";
    text: string;
  } | null>(null);

  const create = () =>
    startTransition(async () => {
      setStatus(null);
      const r = await createBlankWorkbook();
      if (r.ok && r.id) router.push(`/workspace/${r.id}`);
      else if (!r.ok) setStatus({ kind: "error", text: r.error });
    });

  const upload = (file: File) =>
    startTransition(async () => {
      setStatus(null);
      const v = validateUploadFile(file);
      if (!v.ok) return setStatus({ kind: "error", text: v.error });
      let path = "";
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!data.user)
          return setStatus({
            kind: "error",
            text: "Your session has expired. Sign in again.",
          });
        const id = crypto.randomUUID();
        path = `${data.user.id}/${id}.${v.fileType}`;
        setStatus({ kind: "info", text: `Uploading ${file.name}…` });
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            contentType: FILE_TYPES[v.fileType].mime,
            upsert: false,
          });
        if (error)
          return setStatus({
            kind: "error",
            text: "Upload failed. Check your connection and try again.",
          });
        const r = await registerUpload({
          id,
          name: file.name.replace(/\.[^.]+$/, "").slice(0, 120) || "Untitled",
          fileType: v.fileType,
        });
        if (!r.ok) {
          await supabase.storage.from(BUCKET).remove([path]);
          return setStatus({ kind: "error", text: r.error });
        }
        setStatus({
          kind: "info",
          text: `${file.name} uploaded. It is stored but can't be opened as an editable sheet yet.`,
        });
        router.refresh();
      } catch {
        setStatus({
          kind: "error",
          text: "Upload failed. Check your connection and try again.",
        });
      }
    });

  return (
    <section
      className="rounded-xl border border-neutral-200 p-6"
      aria-labelledby="qa"
    >
      <h2 id="qa" className="text-lg font-semibold">
        Quick actions
      </h2>
      <div className="mt-4 space-y-3">
        <input
          ref={input}
          type="file"
          hidden
          accept=".xlsx,.csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) upload(f);
          }}
        />
        <button
          onClick={() => input.current?.click()}
          disabled={busy}
          className={`${row} hover:bg-neutral-50 disabled:opacity-60`}
        >
          <Upload size={20} />
          <span className="flex-1">
            <span className="block text-sm font-medium">Upload file</span>
            <span className="text-xs text-neutral-500">
              XLSX or CSV, up to {MAX_UPLOAD_BYTES / 1024 / 1024} MB
            </span>
          </span>
          <ChevronRight size={16} />
        </button>
        <button
          onClick={create}
          disabled={busy}
          className={`${row} hover:bg-neutral-50 disabled:opacity-60`}
        >
          <FilePlus size={20} />
          <span className="flex-1">
            <span className="block text-sm font-medium">
              New blank workbook
            </span>
            <span className="text-xs text-neutral-500">
              Creates a record. The editor comes later.
            </span>
          </span>
          <ChevronRight size={16} />
        </button>
      </div>
      {status && (
        <p
          role={status.kind === "error" ? "alert" : "status"}
          className={`mt-4 text-sm ${status.kind === "error" ? "text-red-600" : "text-neutral-600"}`}
        >
          {status.text}
        </p>
      )}
    </section>
  );
}
