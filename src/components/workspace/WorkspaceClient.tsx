"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Download,
  Loader2,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MAX_SNAPSHOT_BYTES } from "@/lib/workbooks/snapshot";
import { AiPanel, type PanelApi } from "./AiPanel";
import { applyEffect, extractModel } from "./univer-adapter";
import UniverSheet, { type SheetHandle } from "./UniverSheet";

type Save = "saved" | "dirty" | "saving" | "error";

export default function WorkspaceClient({
  id,
  name,
  snapshot,
  version,
}: {
  id: string;
  name: string;
  snapshot: unknown;
  version: number;
}) {
  const handle = useRef<SheetHandle | null>(null);
  const ver = useRef(version);
  const lastSaved = useRef<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);
  const [save, setSave] = useState<Save>("saved");
  const [saveMsg, setSaveMsg] = useState("");
  const [panel, setPanel] = useState<PanelApi | null>(null);
  const [aiOpen, setAiOpen] = useState(true);

  const doSave = useCallback(async (): Promise<boolean> => {
    const h = handle.current;
    if (!h || saving.current) return false;
    const snap = h.getWorkbook().save();
    const text = JSON.stringify(snap);
    if (text === lastSaved.current) {
      setSave("saved");
      return true;
    }
    if (text.length > MAX_SNAPSHOT_BYTES) {
      setSave("error");
      setSaveMsg("This workbook is too large to save (limit 4 MB).");
      return false;
    }
    saving.current = true;
    setSave("saving");
    try {
      const { data, error } = await createClient()
        .from("workbooks")
        .update({ snapshot: snap, snapshot_version: ver.current + 1 })
        .eq("id", id)
        .eq("snapshot_version", ver.current)
        .select("snapshot_version");
      if (error) throw new Error("save");
      if (!data?.length) {
        setSave("error");
        setSaveMsg(
          "This workbook changed in another tab or was deleted. Reload to continue.",
        );
        return false;
      }
      ver.current += 1;
      lastSaved.current = text;
      setSave("saved");
      return true;
    } catch {
      setSave("error");
      setSaveMsg(
        "Couldn't save. Check your connection. Your changes are still on screen.",
      );
      return false;
    } finally {
      saving.current = false;
    }
  }, [id]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void doSave(), 1500);
  }, [doSave]);

  const onChange = useCallback(() => {
    const h = handle.current;
    if (!h) return;
    // Selection-only commands don't change the snapshot, so doSave() will no-op for them.
    setSave((s) => (s === "saved" ? "dirty" : s));
    schedule();
  }, [schedule]);

  const onReady = useCallback((h: SheetHandle) => {
    handle.current = h;
    lastSaved.current = JSON.stringify(h.getWorkbook().save());
    setPanel({
      getModel: () => extractModel(h.getWorkbook()),
      applySteps: (steps) =>
        steps.forEach((s) =>
          s.effects.forEach((e) => applyEffect(h.getWorkbook(), e)),
        ),
      snapshot: () => h.getWorkbook().save(),
      restore: (snap) => {
        h.replace(snap);
      },
    });
  }, []);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (save === "dirty" || save === "saving" || save === "error")
        e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const exportFile = async () => {
    if (await doSave()) {
      const a = document.createElement("a");
      a.href = `/api/workbooks/${id}/export`;
      a.click();
    }
  };
  const status =
    save === "saved" ? (
      <>
        <Check size={14} /> Saved
      </>
    ) : save === "error" ? (
      <>
        <AlertCircle size={14} className="text-red-600" />{" "}
        <span className="text-red-600">{saveMsg}</span>{" "}
        <button className="underline" onClick={() => void doSave()}>
          Retry
        </button>
      </>
    ) : (
      <>
        <Loader2 size={14} className="animate-spin" />{" "}
        {save === "saving" ? "Saving…" : "Unsaved changes"}
      </>
    );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm hover:underline"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p
            className="flex items-center gap-1.5 text-xs text-neutral-500"
            role="status"
          >
            {status}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => void exportFile()}
            className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            <Download size={15} /> Export .xlsx
          </button>
          {!aiOpen && (
            <button
              onClick={() => setAiOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-neutral-950 px-3 py-1.5 text-sm text-white"
            >
              <Sparkles size={15} /> AI Assistant
            </button>
          )}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-neutral-200">
          <UniverSheet
            snapshot={snapshot}
            onReady={onReady}
            onChange={onChange}
          />
        </div>
        {aiOpen && (
          <div className="hidden w-[340px] shrink-0 md:block">
            <AiPanel
              workbookId={id}
              api={panel}
              onClose={() => setAiOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
