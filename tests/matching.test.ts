import { describe, expect, it } from "vitest";
import { scoreMatch } from "@/lib/matching";
const p = {
  transactionType: "SALE",
  propertyType: "APARTMENT",
  status: "ACTIVE",
  area: 100,
  bedrooms: 2,
  priceTotal: 4000000000n,
  depositAmount: null,
  monthlyRent: null,
  neighborhood: "استادان",
  latitude: 37.55,
  longitude: 45.07,
  parking: true,
  elevator: true,
};
const r = {
  transactionType: "SALE",
  propertyTypes: ["APARTMENT"],
  minArea: 80,
  maxArea: 120,
  minBedrooms: 2,
  maxBedrooms: 3,
  minBudget: 3000000000n,
  maxBudget: 5000000000n,
  neighborhoods: ["استادان"],
  parkingRequired: true,
  elevatorRequired: true,
};
describe("matching", () => {
  it("gives exact match 100", () => expect(scoreMatch(p, r).score).toBe(100));
  it("rejects wrong transaction", () =>
    expect(scoreMatch({ ...p, transactionType: "RENT" }, r).score).toBe(0));
  it("explains missing amenity", () =>
    expect(scoreMatch({ ...p, parking: false }, r).reasons).toContain(
      "فاقد پارکینگ",
    ));
});
