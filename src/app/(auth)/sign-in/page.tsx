import Link from "next/link";
import { SignInForm } from "@/components/auth/Forms";
import { Notices } from "@/components/auth/Notices";

export const metadata = { title: "Sign in — ExcelAI" };

export default async function Page(props: PageProps<"/sign-in">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mb-6 mt-1 text-sm text-neutral-600">
        Welcome back to ExcelAI.
      </p>
      <Notices code={sp.error ?? sp.notice} />
      <SignInForm next={next} />
      <p className="mt-6 text-center text-sm text-neutral-600">
        New to ExcelAI?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-neutral-950 underline"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}
