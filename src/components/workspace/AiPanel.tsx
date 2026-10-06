"use client";
import { useRef, useState } from "react";
import { ArrowUp, Loader2, Sparkles, X } from "lucide-react";
import { buildContext } from "@/lib/ai/context";
import {
  planAll,
  verifyModels,
  type Cell,
  type Step,
  type WorkbookModel,
} from "@/lib/operations/engine";
import { planSchema, type Op } from "@/lib/operations/schema";

type Msg = {
  role: "user" | "assistant";
  text: string;
  table?: Cell[][];
  kind?: "error" | "ok" | "warn";
};
type Pending = { ops: Op[]; summaries: string[] };

export type PanelApi = {
  getModel: () => WorkbookModel;
  applySteps: (steps: Step[]) => void;
  snapshot: () => unknown;
  restore: (snap: unknown) => void;
};

function Table({ rows }: { rows: Cell[][] }) {
  const shown = rows.slice(0, 13);
  return (
    <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-neutral-200 bg-white">
      <table className="w-full text-[11px]">
        <tbody>
          {shown.map((r, i) => (
            <tr
              key={i}
              className={
                i === 0
                  ? "bg-neutral-50 font-medium"
                  : "border-t border-neutral-100"
              }
            >
              {r.slice(0, 8).map((c, j) => (
                <td key={j} className="max-w-28 truncate px-2 py-1">
                  {typeof c === "number"
                    ? c.toLocaleString("en-US", { maximumFractionDigits: 2 })
                    : String(c ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length && (
        <p className="px-2 py-1 text-[11px] text-neutral-500">
          Showing {shown.length - 1} of {rows.length - 1} rows.
        </p>
      )}
    </div>
  );
}

export function AiPanel({
  workbookId,
  api,
  onClose,
}: {
  workbookId: string;
  api: PanelApi | null;
  onClose: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [backup, setBackup] = useState<unknown>(null);
  const end = useRef<HTMLDivElement>(null);

  const push = (m: Msg) => {
    setMsgs((p) => [...p, m]);
    setTimeout(() => end.current?.scrollIntoView({ block: "end" }), 0);
  };

  /** Plans against the CURRENT sheet, applies via Univer, then verifies the real result. */
  function execute(ops: Op[]) {
    if (!api) return;
    const before = api.getModel();
    const plan = planAll(before, ops);
    if (!plan.ok)
      return push({
        role: "assistant",
        kind: "error",
        text: `${plan.error}\nNothing was changed.`,
      });
    const changes = plan.steps.flatMap((s) => s.effects).length;
    const saved = changes ? api.snapshot() : null;
    try {
      api.applySteps(plan.steps);
    } catch (e) {
      if (saved) setBackup(saved);
      return push({
        role: "assistant",
        kind: "error",
        text: `An operation failed partway (${e instanceof Error ? e.message : "unknown error"}). Some changes may have been applied. Use "Undo last AI change" to restore the previous state.`,
      });
    }
    if (saved) setBackup(saved);
    const mismatches = changes
      ? verifyModels(plan.expected, api.getModel())
      : [];
    const table = [...plan.steps].reverse().find((s) => s.table)?.table;
    const summary = plan.steps.map((s) => `• ${s.summary}`).join("\n");
    push(
      mismatches.length
        ? {
            role: "assistant",
            kind: "warn",
            text: `${summary}\n\nApplied, but verification found differences:\n${mismatches.map((m) => `– ${m}`).join("\n")}\nReview the sheet or undo the change.`,
            table,
          }
        : {
            role: "assistant",
            kind: "ok",
            text: changes
              ? `${summary}\n\nVerified: the sheet matches the expected result.`
              : summary,
            table,
          },
    );
  }

  async function send() {
    const text = input.trim();
    if (!text || busy || !api) return;
    setInput("");
    setPending(null);
    push({ role: "user", text });
    setBusy(true);
    try {
      const model = api.getModel();
      const res = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workbookId,
          message: text,
          context: buildContext(model),
          history: msgs
            .slice(-6)
            .map((m) => ({ role: m.role, content: m.text.slice(0, 500) })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok)
        return push({
          role: "assistant",
          kind: "error",
          text: json.error ?? "The AI request failed. Nothing was changed.",
        });
      const parsed = planSchema.safeParse(json.plan);
      if (!parsed.success)
        return push({
          role: "assistant",
          kind: "error",
          text: "The AI returned a plan the app can't run. Nothing was changed.",
        });
      const plan = parsed.data;
      if (plan.clarification)
        return push({ role: "assistant", text: plan.clarification });
      if (!plan.operations.length)
        return push({
          role: "assistant",
          text:
            plan.message ??
            "I couldn't find a supported operation for that request.",
        });
      const dry = planAll(model, plan.operations);
      if (!dry.ok)
        return push({
          role: "assistant",
          kind: "error",
          text: `${dry.error}\nNothing was changed.`,
        });
      if (dry.steps.some((s) => s.destructive)) {
        setPending({
          ops: plan.operations,
          summaries: dry.steps.map((s) => s.summary),
        });
        return push({
          role: "assistant",
          text: "This will make changes that remove or overwrite data. Review and confirm:",
        });
      }
      execute(plan.operations);
    } catch {
      push({
        role: "assistant",
        kind: "error",
        text: "Can't reach the server. Check your connection. Nothing was changed.",
      });
    } finally {
      setBusy(false);
    }
  }

  const tone = (k?: Msg["kind"]) =>
    k === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : k === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-neutral-200 bg-white text-neutral-800";
  return (
    <aside
      className="flex h-full w-full flex-col rounded-xl border border-neutral-200 bg-white"
      aria-label="AI Assistant"
    >
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Sparkles size={16} /> AI Assistant
        </span>
        <button
          onClick={onClose}
          aria-label="Close assistant"
          className="rounded p-1 hover:bg-neutral-100"
        >
          <X size={16} />
        </button>
      </div>
      <div
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
        aria-live="polite"
      >
        {msgs.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Sparkles size={30} />
            <p className="mt-4 text-lg font-medium">
              How can I help you today?
            </p>
            <p className="mt-2 max-w-60 text-sm text-neutral-500">
              Ask me anything about your spreadsheet or data.
            </p>
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <p
              key={i}
              className="ml-8 whitespace-pre-wrap rounded-2xl bg-neutral-100 px-3 py-2 text-sm"
            >
              {m.text}
            </p>
          ) : (
            <div
              key={i}
              className={`rounded-2xl border px-3 py-2 text-sm ${tone(m.kind)}`}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.table && <Table rows={m.table} />}
            </div>
          ),
        )}
        {pending && (
          <div className="rounded-xl border border-neutral-300 p-3 text-sm">
            <ul className="space-y-1">
              {pending.summaries.map((s, i) => (
                <li key={i}>• {s}</li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  const p = pending;
                  setPending(null);
                  execute(p.ops);
                }}
                className="rounded-full bg-neutral-950 px-4 py-1.5 text-white"
              >
                Apply changes
              </button>
              <button
                onClick={() => {
                  setPending(null);
                  push({
                    role: "assistant",
                    text: "Cancelled. Nothing was changed.",
                  });
                }}
                className="rounded-full border border-neutral-300 px-4 py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {busy && (
          <p className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 size={14} className="animate-spin" /> Thinking…
          </p>
        )}
        {backup !== null && !busy && (
          <button
            onClick={() => {
              api?.restore(backup);
              setBackup(null);
              push({
                role: "assistant",
                text: "Restored the sheet to its state before the last AI change.",
              });
            }}
            className="text-xs text-neutral-600 underline"
          >
            Undo last AI change
          </button>
        )}
        <div ref={end} />
      </div>
      <div className="p-3">
        <div className="flex items-end gap-2 rounded-xl border border-neutral-300 p-2 focus-within:border-neutral-950">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Ask a question…"
            aria-label="Message the AI assistant"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-1 text-sm outline-none"
          />
          <button
            onClick={() => void send()}
            disabled={busy || !input.trim() || !api}
            aria-label="Send"
            className="grid size-8 place-items-center rounded-full bg-neutral-950 text-white disabled:opacity-40"
          >
            <ArrowUp size={16} />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-neutral-500">
          ExcelAI can make mistakes. Check important info.
        </p>
      </div>
    </aside>
  );
}
