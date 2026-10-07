import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div
      className="grid h-[50vh] place-items-center text-sm text-neutral-500"
      role="status"
    >
      <span className="flex items-center gap-2">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </span>
    </div>
  );
}
