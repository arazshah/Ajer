import { describe, expect, it } from "vitest";
import type { Property } from "@prisma/client";
import {
  aiPropertyCriteriaSchema,
  scorePropertyForAiSearch,
} from "@/lib/ai-property-search";

const property = {
  status: "ACTIVE",
  transactionType: "SALE",
  propertyType: "APARTMENT",
  neighborhood: "استادان",
  area: 105,
  bedrooms: 2,
  parking: true,
  elevator: true,
  priceTotal: 5_500_000_000n,
  depositAmount: null,
  monthlyRent: null,
  title: "آپارتمان نورگیر استادان",
  description: "ساختمان آرام و بازسازی‌شده",
  address: "ارومیه، استادان",
} as Property;
const criteria = aiPropertyCriteriaSchema.parse({
  summary: "آپارتمان دوخوابه در استادان تا شش میلیارد",
  transactionTypes: ["SALE"],
  propertyTypes: ["APARTMENT"],
  neighborhoods: ["استادان"],
  maxPrice: 6_000_000_000,
  minBedrooms: 2,
  parkingRequired: true,
  elevatorRequired: true,
  keywords: ["نورگیر"],
});

describe("AI property search", () => {
  it("scores a compatible natural-language interpretation", () => {
    const result = scorePropertyForAiSearch(property, criteria);
    expect(result?.score).toBeGreaterThanOrEqual(90);
    expect(result?.reasons).toContain("محله استادان");
  });
  it("rejects a property outside the interpreted budget", () => {
    expect(
      scorePropertyForAiSearch(
        { ...property, priceTotal: 7_000_000_000n },
        criteria,
      ),
    ).toBeNull();
  });
  it("rejects malformed AI criteria", () => {
    expect(
      aiPropertyCriteriaSchema.safeParse({
        summary: "",
        transactionTypes: ["UNKNOWN"],
      }).success,
    ).toBe(false);
  });
});
