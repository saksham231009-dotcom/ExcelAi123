import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-xl font-semibold">Workbook not found</h1>
      <p className="mt-2 text-sm text-neutral-600">
        It may have been deleted, or you don&apos;t have access to it.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-block rounded-full bg-neutral-950 px-5 py-2.5 text-sm text-white"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
