"use client";
import { useSyncExternalStore } from "react";

const utcText = (d: Date) =>
  d.toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC";
const localText = (d: Date) =>
  d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const noop = () => () => {};

/**
 * Renders a persisted UTC timestamp in the viewer's local time.
 * Server render and hydration use a deterministic UTC string (no mismatch); the client then shows local time.
 */
export default function LocalTime({ iso }: { iso: string }) {
  const d = new Date(iso);
  const valid = !Number.isNaN(d.getTime());
  const text = useSyncExternalStore(
    noop,
    () => (valid ? localText(d) : "—"),
    () => (valid ? utcText(d) : "—"),
  );
  return (
    <time dateTime={valid ? d.toISOString() : undefined} title={valid ? d.toISOString() : undefined}>
      {text}
    </time>
  );
}
