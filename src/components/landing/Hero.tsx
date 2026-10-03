import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";

const rows = [
  ["Ava Patel", "ava@example.com", "$1,200"],
  ["Ben Ortiz", "ben@example.com", "$860"],
  ["Ava Patel", "ava@example.com", "$1,200"],
  ["Chen Wei", "chen@example.com", "$2,040"],
];

function Preview() {
  return (
    <div className="relative">
      <div
        className="overflow-hidden rounded-xl border border-white/15 bg-neutral-900 shadow-2xl"
        role="img"
        aria-label="Illustrative preview of the ExcelAI workspace with sample data"
      >
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-2 rounded-full bg-white/25" />
          ))}
          <span className="ml-3 text-[11px] text-neutral-400">
            customers.xlsx · sample data
          </span>
        </div>
        <div className="grid grid-cols-[1fr] sm:grid-cols-[1.5fr_1fr]">
          <div className="bg-white p-3 text-[11px] text-neutral-800">
            <div className="grid grid-cols-3 border-b border-neutral-200 bg-neutral-50 font-medium">
              {["Name", "Email", "Revenue"].map((h) => (
                <div key={h} className="px-2 py-1.5">
                  {h}
                </div>
              ))}
            </div>
            {rows.map((r, i) => (
              <div
                key={i}
                className={`grid grid-cols-3 border-b border-neutral-100 ${i === 2 ? "bg-neutral-200" : ""}`}
              >
                {r.map((c, j) => (
                  <div key={j} className="truncate px-2 py-1.5">
                    {c}
                  </div>
                ))}
              </div>
            ))}
            <p className="mt-2 px-2 text-[10px] text-neutral-500">
              Highlighted row would be removed after you confirm.
            </p>
          </div>
          <div className="space-y-3 border-t border-white/10 bg-neutral-950 p-4 text-[11px] sm:border-l sm:border-t-0">
            <div className="flex items-center gap-1.5 text-neutral-300">
              <Sparkles size={12} /> AI Assistant
            </div>
            <p className="rounded-lg bg-white/10 p-2.5 text-neutral-200">
              Remove duplicate customers from this sheet.
            </p>
            <p className="rounded-lg border border-white/10 p-2.5 text-neutral-300">
              Found 1 duplicate row. Review the highlighted row, then confirm.
            </p>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-neutral-500">
        Illustrative preview with sample data.
      </p>
    </div>
  );
}

export function Hero() {
  return (
    <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:pt-20">
      <div>
        <span className="inline-block rounded-full border border-white/15 px-3 py-1 text-xs text-neutral-300">
          AI-powered spreadsheet platform · in development
        </span>
        <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
          Talk to your spreadsheet. Get the work done.
        </h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-neutral-400">
          Describe what you want in plain language. ExcelAI works on your actual
          data and shows you the changes before they apply.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
          >
            Get started free <ArrowRight size={16} />
          </Link>
          <Link
            href="/#how-it-works"
            className="inline-flex items-center rounded-full border border-white/25 px-6 py-3 text-sm font-medium text-white hover:bg-white/10"
          >
            See how it works
          </Link>
        </div>
        <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-xs text-neutral-400">
          {["No credit card required", "Payments not enabled yet"].map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <Check size={13} /> {t}
            </li>
          ))}
        </ul>
      </div>
      <Preview />
    </section>
  );
}
