/** Server-side diagnostics: logs error codes/status only, never passwords, keys, emails or workbook contents. */
export function logError(scope: string, err: unknown): void {
  const e = (err ?? {}) as {
    code?: unknown;
    status?: unknown;
    name?: unknown;
    message?: unknown;
  };
  console.error(`[excelai] ${scope}`, {
    code: e.code,
    status: e.status,
    name: e.name,
    message:
      typeof e.message === "string" ? e.message.slice(0, 200) : undefined,
  });
}
