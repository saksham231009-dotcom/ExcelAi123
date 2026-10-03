import { Shell } from "@/components/landing/Notice";

export const metadata = { title: "Sign in — ExcelAI" };

export default function Page() {
  return (
    <Shell title="Sign in">
      <p className="mt-4 text-neutral-700">
        Accounts are not available yet. Authentication is being connected and
        will appear here. No account can be created or signed in to at this
        time.
      </p>
    </Shell>
  );
}
