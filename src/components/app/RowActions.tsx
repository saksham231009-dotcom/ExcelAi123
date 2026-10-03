"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { deleteWorkbook, renameWorkbook } from "@/app/(app)/dashboard/actions";

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function RowActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [mode, setMode] = useState<"rename" | "delete" | null>(null);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const close = () => {
    setMode(null);
    setError(null);
  };

  const run = (fn: () => ReturnType<typeof renameWorkbook>) =>
    start(async () => {
      setError(null);
      try {
        const r = await fn();
        if (r.ok) {
          close();
          router.refresh();
        } else setError(r.error);
      } catch {
        setError("Something went wrong. Check your connection and try again.");
      }
    });

  return (
    <div className="relative">
      <button
        onClick={() => setMenu(!menu)}
        aria-label={`Actions for ${name}`}
        aria-expanded={menu}
        className="rounded-md p-1.5 hover:bg-neutral-100"
      >
        <MoreHorizontal size={18} />
      </button>
      {menu && (
        <div
          role="menu"
          className="absolute right-0 z-10 w-36 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg"
        >
          <button
            role="menuitem"
            className="w-full rounded px-3 py-2 text-left text-sm hover:bg-neutral-50"
            onClick={() => {
              setMenu(false);
              setValue(name);
              setMode("rename");
            }}
          >
            Rename
          </button>
          <button
            role="menuitem"
            className="w-full rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-neutral-50"
            onClick={() => {
              setMenu(false);
              setMode("delete");
            }}
          >
            Delete
          </button>
        </div>
      )}
      {mode === "rename" && (
        <Modal title="Rename workbook" onClose={close}>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => renameWorkbook(id, value));
            }}
          >
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={120}
              aria-label="Workbook name"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-950"
            />
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-full border border-neutral-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                disabled={pending}
                className="rounded-full bg-neutral-950 px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {mode === "delete" && (
        <Modal title="Delete workbook?" onClose={close}>
          <p className="mt-2 text-sm text-neutral-600">
            “{name}” and its file will be permanently deleted. This can&apos;t
            be undone.
          </p>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={close}
              className="rounded-full border border-neutral-300 px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              disabled={pending}
              onClick={() => run(() => deleteWorkbook(id))}
              className="rounded-full bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-60"
            >
              {pending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
