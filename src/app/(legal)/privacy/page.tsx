import { Draft, Shell } from "@/components/landing/Notice";

export const metadata = { title: "Privacy Policy (draft) — ExcelAI" };

export default function Privacy() {
  return (
    <Shell title="Privacy Policy">
      <Draft />
      <div className="mt-6 space-y-4 text-neutral-700 leading-relaxed">
        <p>Last updated: draft, not yet in effect.</p>
        <h2 className="text-lg font-semibold text-neutral-950">
          Information we expect to handle
        </h2>
        <p>
          Account details such as your email address, and the spreadsheet files
          and data you choose to upload.
        </p>
        <h2 className="text-lg font-semibold text-neutral-950">
          AI processing
        </h2>
        <p>
          When you make an AI request, relevant parts of your workbook may be
          sent to a third-party AI provider to process it. Final wording about
          providers and retention is to be confirmed.
        </p>
        <h2 className="text-lg font-semibold text-neutral-950">Your choices</h2>
        <p>
          Details on access, export and deletion of your data are to be written
          before launch.
        </p>
      </div>
    </Shell>
  );
}
