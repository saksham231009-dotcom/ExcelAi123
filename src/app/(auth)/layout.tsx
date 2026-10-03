import Link from "next/link";
import { Logo } from "@/components/landing/Logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <div className="mx-auto w-full max-w-5xl px-5 py-6">
        <Logo />
      </div>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-16">
        <div className="rounded-xl border border-neutral-200 bg-white p-7 shadow-sm">
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-neutral-500">
          <Link href="/" className="underline">
            Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
