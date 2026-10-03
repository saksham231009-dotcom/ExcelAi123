import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  FileText,
  Globe,
  Lock,
  Sparkles,
  Table2,
} from "lucide-react";

const principles = [
  "You review changes before they apply",
  "Spreadsheet edits run as tested operations, not AI-written code",
  "Your files stay private to your account",
  "You can edit every cell yourself",
];

export function Principles() {
  return (
    <section
      className="border-b border-neutral-200 bg-neutral-50"
      aria-label="Design principles"
    >
      <ul className="mx-auto grid max-w-7xl gap-6 px-5 py-8 text-sm text-neutral-700 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
        {principles.map((p) => (
          <li key={p} className="flex gap-2.5">
            <Check size={16} className="mt-0.5 shrink-0" />
            {p}
          </li>
        ))}
      </ul>
    </section>
  );
}

const features = [
  {
    icon: Sparkles,
    title: "Plain-language requests",
    text: "Ask for an operation in your own words. Removing duplicate rows is the first one being built.",
    status: "In development",
  },
  {
    icon: Table2,
    title: "Editable workbooks",
    text: "Open XLSX and CSV files in an editable grid, save your changes and export the result.",
    status: "In development",
  },
  {
    icon: FileText,
    title: "Data extraction",
    text: "Pull tables from PDFs and images into a structured sheet.",
    status: "Planned",
  },
  {
    icon: Globe,
    title: "Web import",
    text: "Import data from a web page you provide, where the site allows it.",
    status: "Planned",
  },
  {
    icon: BarChart3,
    title: "Charts and dashboards",
    text: "Generate charts and summaries from the data in your workbook.",
    status: "Planned",
  },
  {
    icon: Lock,
    title: "Private by design",
    text: "Per-account access and private file storage are part of the foundation.",
    status: "In development",
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-4 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_2.2fr]">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-950">
            Everything you need in one platform
          </h2>
          <p className="mt-4 max-w-sm text-neutral-600">
            From cleaning data to building reports, work with your spreadsheet
            in plain language. Status labels show what is built and what is not.
          </p>
          <Link
            href="/sign-up"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Get started free <ArrowRight size={15} />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {features.map(({ icon: Icon, title, text, status }) => (
            <article
              key={title}
              className="rounded-xl border border-neutral-200 p-5"
            >
              <div className="flex items-start justify-between">
                <span className="grid size-9 place-items-center rounded-lg border border-neutral-200">
                  <Icon size={18} />
                </span>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600">
                  {status}
                </span>
              </div>
              <h3 className="mt-4 font-semibold text-neutral-950">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                {text}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const steps = [
  ["Create an account", "Sign up with your email."],
  ["Upload your data", "Add an XLSX or CSV file."],
  ["Describe the task", "Say what you want done, in plain language."],
  ["Review and confirm", "Check the preview, then apply the change."],
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-4 border-y border-neutral-200 bg-neutral-50"
    >
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <h2 className="text-3xl font-semibold tracking-tight text-neutral-950">
          Get started in 4 steps
        </h2>
        <p className="mt-3 max-w-md text-neutral-600">
          Every change is previewed first, so you stay in control of your data.
        </p>
        <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([t, d], i) => (
            <li key={t}>
              <span className="grid size-7 place-items-center rounded-full bg-neutral-950 text-xs font-medium text-white">
                {i + 1}
              </span>
              <h3 className="mt-3 font-medium text-neutral-950">{t}</h3>
              <p className="mt-1 text-sm text-neutral-600">{d}</p>
            </li>
          ))}
        </ol>
        <Link
          href="/sign-up"
          className="mt-10 inline-flex rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Start now
        </Link>
      </div>
    </section>
  );
}

const included = [
  "Editable spreadsheet workspace (in development)",
  "AI requests with preview before changes (in development)",
  "Duplicate-row removal, the first operation (in development)",
  "More operations are planned and will be added over time",
];

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-4 bg-neutral-950 text-white">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <h2 className="text-center text-3xl font-semibold tracking-tight">
          One simple plan
        </h2>
        <p className="mx-auto mt-3 max-w-md text-center text-neutral-400">
          One price, no tiers. Billing is not enabled yet and you will not be
          charged today.
        </p>
        <div className="mx-auto mt-10 max-w-md rounded-xl bg-white p-7 text-neutral-950">
          <h3 className="font-semibold">ExcelAI Pro</h3>
          <p className="mt-3">
            <span className="text-4xl font-semibold tracking-tight">$10</span>
            <span className="text-neutral-500">/month</span>
          </p>
          <ul className="mt-6 space-y-2.5 text-sm text-neutral-700">
            {included.map((i) => (
              <li key={i} className="flex gap-2.5">
                <Check size={16} className="mt-0.5 shrink-0" />
                {i}
              </li>
            ))}
          </ul>
          <Link
            href="/sign-up"
            className="mt-7 block rounded-full bg-neutral-950 py-3 text-center text-sm font-medium text-white hover:bg-neutral-800"
          >
            Create a free account
          </Link>
          <p className="mt-3 text-center text-xs text-neutral-500">
            Subscription checkout will be added before paid use. No payment
            details are collected.
          </p>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white text-sm text-neutral-600">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>© 2026 ExcelAI. All rights reserved.</p>
        <nav className="flex gap-6" aria-label="Legal">
          <Link href="/privacy" className="hover:text-neutral-950">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-neutral-950">
            Terms of Service
          </Link>
        </nav>
      </div>
    </footer>
  );
}
