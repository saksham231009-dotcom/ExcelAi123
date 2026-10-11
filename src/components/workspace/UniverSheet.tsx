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
import { UniverSheetsConditionalFormattingPreset } from "@univerjs/preset-sheets-conditional-formatting";
import cfEnUS from "@univerjs/preset-sheets-conditional-formatting/locales/en-US";
import "@univerjs/preset-sheets-conditional-formatting/lib/index.css";

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
  const univerInstance = useRef<ReturnType<typeof createUniver> | null>(null);
  const workbook = useRef<FWorkbook | null>(null);
  const disposeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!el.current) return;
    if (disposeTimer.current) clearTimeout(disposeTimer.current);
    disposeTimer.current = null;

    let instance = univerInstance.current;
    if (!instance) {
      instance = createUniver({
        locale: LocaleType.EN_US,
        locales: { [LocaleType.EN_US]: mergeLocales(enUS, cfEnUS) },
        presets: [
          UniverSheetsCorePreset({ container: el.current }),
          UniverSheetsConditionalFormattingPreset(),
        ],
      });
      univerInstance.current = instance;
    }
    const api = instance.univerAPI;
    const holder: { wb: FWorkbook } = {
      wb:
        workbook.current ??
        api.createWorkbook(initial.current as never),
    };
    workbook.current = holder.wb;
    const sub = instance.univerAPI.addEvent(
      instance.univerAPI.Event.CommandExecuted,
      () => cb.current.onChange(),
    );
    cb.current.onReady({
      api: instance.univerAPI,
      getWorkbook: () => holder.wb,
      replace: (snap) => {
        api.disposeUnit(holder.wb.getId());
        holder.wb = api.createWorkbook(snap as never);
        workbook.current = holder.wb;
      },
    });
    return () => {
      sub.dispose();
      disposeTimer.current = setTimeout(() => {
        if (univerInstance.current === instance) {
          instance.univer.dispose();
          univerInstance.current = null;
          workbook.current = null;
        }
        disposeTimer.current = null;
      }, 0);
    };
  }, []);

  return <div ref={el} className="h-full w-full" />;
}
