import Link from "next/link";

export const metadata = { title: "Help & Support — ExcelAI" };

const faqs: [string, string][] = [
  [
    "Which files can I upload?",
    "XLSX and CSV files up to 5 MB. Very large sheets (over about 250,000 cells) can't be opened yet. Dates in XLSX files are imported as text (YYYY-MM-DD).",
  ],
  [
    "What can the AI assistant do?",
    "Write or edit cells, add formulas and columns, rename or delete columns, insert or delete rows, sort, remove duplicates, find and replace, fill blanks, clean text, format and highlight cells, manage sheets, and answer questions such as totals, averages, top N and summaries. Charts, merging cells and moving ranges aren't supported yet.",
  ],
  [
    "Will the AI change my data without asking?",
    "Destructive changes (deleting rows, columns or sheets, clearing cells, removing duplicates, large overwrites) show a preview and wait for your confirmation. After every change the app re-reads your sheet and tells you whether it matches the expected result. “Undo last AI change” restores the previous state.",
  ],
  [
    "What does the AI see?",
    "Your request, sheet names, column headers and up to 4 sample rows of the active sheet. Results like totals are calculated by the app, not guessed by the AI.",
  ],
  [
    "My changes aren't saving.",
    "Watch the save status above the sheet. If it shows an error, check your connection and press Retry. If it says the workbook changed in another tab, reload the page.",
  ],
  [
    "I didn't get the confirmation or reset email.",
    "Check spam, then request it again. Email sending can be rate limited; wait a few minutes between attempts.",
  ],
  [
    "The AI says it isn't configured or returns an error.",
    "The AI needs a server-side OpenAI key. If you run ExcelAI yourself, set OPENAI_API_KEY and OPENAI_MODEL in .env.local and restart.",
  ],
];

export default function Help() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">
        Help &amp; Support
      </h1>
      <h2 className="mt-8 text-lg font-semibold">Getting started</h2>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-neutral-700">
        <li>
          Go to{" "}
          <Link href="/workbooks" className="underline">
            My Workbooks
          </Link>{" "}
          and upload a file or create a blank workbook.
        </li>
        <li>
          Click the workbook to open it in the workspace and edit cells like any
          spreadsheet.
        </li>
        <li>
          Ask the AI assistant for what you need, for example “remove duplicate
          customers” or “top 5 products by revenue”.
        </li>
        <li>
          Changes save automatically. Use Export to download an .xlsx copy.
        </li>
      </ol>
      <h2 className="mt-8 text-lg font-semibold">Questions</h2>
      <div className="mt-3 divide-y divide-neutral-200 rounded-xl border border-neutral-200">
        {faqs.map(([q, a]) => (
          <details key={q} className="group p-4">
            <summary className="cursor-pointer text-sm font-medium">
              {q}
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{a}</p>
          </details>
        ))}
      </div>
      <p className="mt-8 text-sm text-neutral-600">
        A support contact hasn&apos;t been set up yet. Read the{" "}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link href="/terms" className="underline">
          Terms of Service
        </Link>{" "}
        (both drafts).
      </p>
    </div>
  );
}
