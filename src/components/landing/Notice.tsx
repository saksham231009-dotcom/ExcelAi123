import Link from "next/link";
import { Logo } from "./Logo";

export function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="mx-auto w-full max-w-3xl px-5 py-6">
        <Logo />
      </div>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-16">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {children}
        <Link href="/" className="mt-10 inline-block text-sm underline">
          Back to home
        </Link>
      </main>
    </div>
  );
}

export function Draft() {
  return (
    <p
      role="note"
      className="mt-4 rounded-lg border border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-700"
    >
      <strong>Draft.</strong> This document is a placeholder and has not been
      reviewed by a lawyer. It must be reviewed and replaced before ExcelAI is
      launched to the public.
    </p>
  );
}
