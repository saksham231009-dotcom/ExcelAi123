import Link from "next/link";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 font-semibold tracking-tight"
      aria-label="ExcelAI home"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 22 22"
        fill="currentColor"
        aria-hidden
      >
        {[0, 8, 16].flatMap((x) =>
          [0, 8, 16].map((y) => (
            <rect key={`${x}${y}`} x={x} y={y} width="6" height="6" rx="1.5" />
          )),
        )}
      </svg>
      <span className={`text-lg ${light ? "text-white" : "text-neutral-950"}`}>
        ExcelAI
      </span>
    </Link>
  );
}
