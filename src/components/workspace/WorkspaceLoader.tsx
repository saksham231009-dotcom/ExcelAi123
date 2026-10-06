"use client";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const WorkspaceClient = dynamic(() => import("./WorkspaceClient"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[60vh] place-items-center text-sm text-neutral-500">
      <Loader2 className="animate-spin" />{" "}
      <span className="sr-only">Loading spreadsheet…</span>
    </div>
  ),
});

export default function WorkspaceLoader(props: {
  id: string;
  name: string;
  snapshot: unknown;
  version: number;
}) {
  return <WorkspaceClient {...props} />;
}
