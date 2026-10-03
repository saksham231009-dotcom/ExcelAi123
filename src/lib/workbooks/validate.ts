export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB initial limit
export const MAX_NAME_LENGTH = 120;
export const BUCKET = "workbooks";

export const FILE_TYPES = {
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    accepts: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  },
  csv: {
    mime: "text/csv",
    accepts: ["text/csv", "application/vnd.ms-excel", "text/plain"],
  },
} as const;
export type UploadType = keyof typeof FILE_TYPES;

export function getExtension(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i < 0 ? "" : filename.slice(i + 1).toLowerCase();
}

export function validateUploadFile(file: {
  name: string;
  size: number;
  type: string;
}): { ok: true; fileType: UploadType } | { ok: false; error: string } {
  const ext = getExtension(file.name);
  if (ext !== "xlsx" && ext !== "csv") {
    return {
      ok: false,
      error: "Unsupported file type. Upload an .xlsx or .csv file.",
    };
  }
  if (file.size <= 0) return { ok: false, error: "The file is empty." };
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `File is too large. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
    };
  }
  const accepts: readonly string[] = FILE_TYPES[ext].accepts;
  if (file.type && !accepts.includes(file.type)) {
    return {
      ok: false,
      error: "The file's content type doesn't match its extension.",
    };
  }
  return { ok: true, fileType: ext };
}

export function cleanWorkbookName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim();
  return name.length >= 1 && name.length <= MAX_NAME_LENGTH ? name : null;
}

export function storagePath(
  userId: string,
  workbookId: string,
  fileType: UploadType,
) {
  return `${userId}/${workbookId}.${fileType}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const units: [number, string][] = [
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];
  for (const [secs, label] of units) {
    if (s >= secs) {
      const v = Math.floor(s / secs);
      return `${v} ${label}${v > 1 ? "s" : ""} ago`;
    }
  }
  return "just now";
}
