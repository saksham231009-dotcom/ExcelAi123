import { describe, it, expect } from "vitest";
import {
  validateUploadFile,
  cleanWorkbookName,
  storagePath,
  MAX_UPLOAD_BYTES,
  timeAgo,
} from "@/lib/workbooks/validate";

describe("validateUploadFile", () => {
  const XLSX =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  it("accepts xlsx and csv", () => {
    expect(
      validateUploadFile({ name: "a.xlsx", size: 10, type: XLSX }),
    ).toEqual({ ok: true, fileType: "xlsx" });
    expect(validateUploadFile({ name: "A.CSV", size: 10, type: "" })).toEqual({
      ok: true,
      fileType: "csv",
    });
  });
  it("rejects unsupported, empty, oversized, mismatched", () => {
    expect(
      validateUploadFile({ name: "a.pdf", size: 10, type: "application/pdf" })
        .ok,
    ).toBe(false);
    expect(validateUploadFile({ name: "noext", size: 10, type: "" }).ok).toBe(
      false,
    );
    expect(validateUploadFile({ name: "a.csv", size: 0, type: "" }).ok).toBe(
      false,
    );
    expect(
      validateUploadFile({
        name: "a.csv",
        size: MAX_UPLOAD_BYTES + 1,
        type: "",
      }).ok,
    ).toBe(false);
    expect(
      validateUploadFile({ name: "a.xlsx", size: 5, type: "application/pdf" })
        .ok,
    ).toBe(false);
  });
});

describe("helpers", () => {
  it("cleans names", () => {
    expect(cleanWorkbookName("  My   Sheet ")).toBe("My Sheet");
    expect(cleanWorkbookName("   ")).toBeNull();
    expect(cleanWorkbookName("x".repeat(121))).toBeNull();
  });
  it("builds owner-scoped storage path", () => {
    expect(storagePath("u1", "w1", "csv")).toBe("u1/w1.csv");
  });
  it("formats time ago", () => {
    const now = Date.parse("2026-10-03T12:00:00Z");
    expect(timeAgo("2026-10-03T10:00:00Z", now)).toBe("2 hours ago");
    expect(timeAgo("2026-10-03T11:59:50Z", now)).toBe("just now");
  });
});
