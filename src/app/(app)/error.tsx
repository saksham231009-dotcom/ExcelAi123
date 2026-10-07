"use client";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md py-20 text-center" role="alert">
      <h1 className="text-xl font-semibold">This page couldn&apos;t load</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Something unexpected went wrong. Your saved workbooks are not affected.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-full bg-neutral-950 px-5 py-2.5 text-sm text-white"
      >
        Try again
      </button>
    </div>
  );
}
