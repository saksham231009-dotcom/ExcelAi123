import { Draft, Shell } from "@/components/landing/Notice";

export const metadata = { title: "Terms of Service (draft) — ExcelAI" };

export default function Terms() {
  return (
    <Shell title="Terms of Service">
      <Draft />
      <div className="mt-6 space-y-4 text-neutral-700 leading-relaxed">
        <p>Last updated: draft, not yet in effect.</p>
        <h2 className="text-lg font-semibold text-neutral-950">
          Use of the service
        </h2>
        <p>
          ExcelAI is under development. Features may change, and the service is
          not yet offered commercially.
        </p>
        <h2 className="text-lg font-semibold text-neutral-950">AI output</h2>
        <p>
          AI-assisted results can contain mistakes. Check important results
          before relying on them.
        </p>
        <h2 className="text-lg font-semibold text-neutral-950">Billing</h2>
        <p>
          Paid plans are not enabled. Pricing and billing terms will be
          finalized before launch.
        </p>
      </div>
    </Shell>
  );
}
