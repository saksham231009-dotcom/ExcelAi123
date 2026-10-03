import Link from "next/link";
import { ForgotForm } from "@/components/auth/Forms";
import { Notices } from "@/components/auth/Notices";

export const metadata = { title: "Reset password — ExcelAI" };

export default async function Page(props: PageProps<"/forgot-password">) {
  const sp = await props.searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        Reset your password
      </h1>
      <p className="mb-6 mt-1 text-sm text-neutral-600">
        Enter your email and we&apos;ll send you a reset link.
      </p>
      <Notices code={sp.error} />
      <ForgotForm />
      <p className="mt-6 text-center text-sm">
        <Link href="/sign-in" className="font-medium underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
