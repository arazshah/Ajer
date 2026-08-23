import { haversineKm } from "./geo";
export type MatchProperty = {
  transactionType: string;
  propertyType: string;
  status: string;
  area: number;
  bedrooms: number | null;
  priceTotal: bigint | null;
  depositAmount: bigint | null;
  monthlyRent: bigint | null;
  neighborhood: string;
  latitude: number;
  longitude: number;
  parking: boolean;
  elevator: boolean;
};
export type MatchRequirement = {
  transactionType: string;
  propertyTypes: string[];
  minArea?: number | null;
  maxArea?: number | null;
  minBedrooms?: number | null;
  maxBedrooms?: number | null;
  minBudget?: bigint | null;
  maxBudget?: bigint | null;
  maxDeposit?: bigint | null;
  maxMonthlyRent?: bigint | null;
  neighborhoods: string[];
  centerLatitude?: number | null;
  centerLongitude?: number | null;
  radiusKm?: number | null;
  parkingRequired: boolean;
  elevatorRequired: boolean;
};
export function scoreMatch(p: MatchProperty, r: MatchRequirement) {
  if (p.transactionType !== r.transactionType || p.status !== "ACTIVE")
    return { score: 0, reasons: ["نوع معامله یا وضعیت فایل سازگار نیست"] };
  let score = 25;
  const reasons: string[] = ["نوع معامله سازگار"];
  if (r.propertyTypes.includes(p.propertyType)) {
    score += 15;
    reasons.push("نوع ملک موردنظر");
  } else reasons.push("نوع ملک متفاوت");
  const price =
    p.transactionType === "SALE" || p.transactionType === "PRESALE"
      ? p.priceTotal
      : p.depositAmount;
  if (
    (!r.minBudget || !price || price >= r.minBudget) &&
    (!r.maxBudget || !price || price <= r.maxBudget)
  ) {
    score += 15;
    reasons.push("محدوده قیمت مناسب");
  } else reasons.push("قیمت خارج از محدوده");
  if (
    (!r.minArea || p.area >= r.minArea) &&
    (!r.maxArea || p.area <= r.maxArea)
  ) {
    score += 15;
    reasons.push("متراژ مناسب");
  } else
    reasons.push(
      p.area > (r.maxArea ?? Infinity)
        ? "متراژ کمی بیشتر از درخواست"
        : "متراژ کمتر از درخواست",
    );
  if (
    (!r.minBedrooms || (p.bedrooms ?? 0) >= r.minBedrooms) &&
    (!r.maxBedrooms || (p.bedrooms ?? 0) <= r.maxBedrooms)
  )
    score += 8;
  let location = false;
  if (r.neighborhoods.includes(p.neighborhood)) {
    location = true;
    reasons.push("محله موردنظر");
  } else if (
    r.centerLatitude &&
    r.centerLongitude &&
    r.radiusKm &&
    haversineKm(p.latitude, p.longitude, r.centerLatitude, r.centerLongitude) <=
      r.radiusKm
  ) {
    location = true;
    reasons.push("در شعاع موردنظر");
  }
  if (location) score += 12;
  if (!r.parkingRequired || p.parking) score += 5;
  else reasons.push("فاقد پارکینگ");
  if (!r.elevatorRequired || p.elevator) score += 5;
  else reasons.push("فاقد آسانسور");
  return { score: Math.min(100, score), reasons };
}
