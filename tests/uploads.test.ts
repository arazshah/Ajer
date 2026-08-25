import { describe, expect, it } from "vitest";
import {
  detectedMime,
  extensionForMime,
  resolveStorageKey,
} from "@/lib/uploads";

describe("private uploads", () => {
  it("detects PDF and image signatures", () => {
    expect(detectedMime(new TextEncoder().encode("%PDF-1.7"))).toBe(
      "application/pdf",
    );
    expect(detectedMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      "image/jpeg",
    );
  });

  it("uses server-controlled extensions", () => {
    expect(extensionForMime("image/png")).toBe("png");
    expect(extensionForMime("text/html")).toBeNull();
  });

  it("rejects storage traversal", () => {
    expect(() => resolveStorageKey("../../etc/passwd")).toThrow();
  });
});
