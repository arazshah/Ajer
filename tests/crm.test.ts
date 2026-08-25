import { describe, expect, it } from "vitest";
import {
  normalizeNationalCode,
  parseTags,
  propertyFingerprint,
} from "@/lib/crm";

describe("CRM normalization", () => {
  it("normalizes Iranian national code digits", () => {
    expect(normalizeNationalCode("۰۰۱۲۳۴۵۶۷۸")).toBe("0012345678");
  });

  it("deduplicates normalized tags", () => {
    expect(parseTags("خریدار ویژه، خریدار ویژه, سرمایه‌گذار")).toEqual([
      "خریدار ویژه",
      "سرمایه‌گذار",
    ]);
  });

  it("generates equal fingerprints for equivalent addresses", () => {
    const base = {
      ownerId: "owner-1",
      propertyType: "APARTMENT",
      area: 90,
    };
    expect(
      propertyFingerprint({ ...base, address: "خیابان كاشانی، پلاک ۱۰" }),
    ).toBe(propertyFingerprint({ ...base, address: "خیابان کاشانی پلاک ۱۰" }));
  });
});
