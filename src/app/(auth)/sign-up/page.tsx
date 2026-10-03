import Link from "next/link";
import { SignUpForm } from "@/components/auth/Forms";
import { Notices } from "@/components/auth/Notices";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create account — ExcelAI" };

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        Create your account
      </h1>
      <p className="mb-6 mt-1 text-sm text-neutral-600">
        No payment details needed.
      </p>
      <Notices />
      <SignUpForm />
      <p className="mt-6 text-center text-sm text-neutral-600">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="font-medium text-neutral-950 underline"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
