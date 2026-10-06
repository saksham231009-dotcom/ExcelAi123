"use client";
import { useEffect, useRef } from "react";
import {
  createUniver,
  LocaleType,
  mergeLocales,
  type FUniver,
} from "@univerjs/presets";
import {
  UniverSheetsCorePreset,
  type FWorkbook,
} from "@univerjs/preset-sheets-core";
import enUS from "@univerjs/preset-sheets-core/locales/en-US";
import "@univerjs/preset-sheets-core/lib/index.css";

export type SheetHandle = {
  api: FUniver;
  getWorkbook: () => FWorkbook;
  /** Replaces the open workbook with the given snapshot (used to restore a previous state). */
  replace: (snapshot: unknown) => void;
};

export default function UniverSheet({
  snapshot,
  onReady,
  onChange,
}: {
  snapshot: unknown;
  onReady: (h: SheetHandle) => void;
  onChange: () => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const cb = useRef({ onReady, onChange });
  useEffect(() => {
    cb.current = { onReady, onChange };
  });
  const initial = useRef(snapshot);

  useEffect(() => {
    if (!el.current) return;
    const { univer, univerAPI } = createUniver({
      locale: LocaleType.EN_US,
      locales: { [LocaleType.EN_US]: mergeLocales(enUS) },
      presets: [UniverSheetsCorePreset({ container: el.current })],
    });
    let wb = univerAPI.createWorkbook(initial.current as never);
    const sub = univerAPI.addEvent(univerAPI.Event.CommandExecuted, () =>
      cb.current.onChange(),
    );
    cb.current.onReady({
      api: univerAPI,
      getWorkbook: () => wb,
      replace: (snap) => {
        univerAPI.disposeUnit(wb.getId());
        wb = univerAPI.createWorkbook(snap as never);
      },
    });
    return () => {
      sub.dispose();
      univer.dispose();
    };
  }, []);

  return <div ref={el} className="h-full w-full" />;
}
