import { z } from "zod";
import type { Property } from "@prisma/client";
import { label } from "./labels";

const nullableNumber = z.number().nonnegative().nullable().optional();

export const aiPropertyCriteriaSchema = z.object({
  summary: z.string().min(1).max(300),
  transactionTypes: z
    .array(z.enum(["SALE", "RENT", "MORTGAGE_RENT", "PRESALE"]))
    .default([]),
  propertyTypes: z
    .array(
      z.enum([
        "APARTMENT",
        "HOUSE",
        "VILLA",
        "LAND",
        "COMMERCIAL",
        "OFFICE",
        "STORE",
        "WAREHOUSE",
      ]),
    )
    .default([]),
  cities: z.array(z.string().min(1).max(80)).default([]),
  districts: z.array(z.string().min(1).max(80)).default([]),
  neighborhoods: z.array(z.string().min(1).max(80)).default([]),
  minPrice: nullableNumber,
  maxPrice: nullableNumber,
  maxDeposit: nullableNumber,
  maxMonthlyRent: nullableNumber,
  minArea: nullableNumber,
  maxArea: nullableNumber,
  minBedrooms: nullableNumber,
  maxBedrooms: nullableNumber,
  parkingRequired: z.boolean().default(false),
  elevatorRequired: z.boolean().default(false),
  keywords: z.array(z.string().min(1).max(80)).default([]),
});

export type AiPropertyCriteria = z.infer<typeof aiPropertyCriteriaSchema>;

function asNumber(value: bigint | null) {
  return value === null ? null : Number(value);
}

export function scorePropertyForAiSearch(
  property: Property,
  criteria: AiPropertyCriteria,
) {
  const reasons: string[] = [];
  if (property.status !== "ACTIVE" && property.status !== "RESERVED")
    return null;
  if (
    criteria.transactionTypes.length &&
    !criteria.transactionTypes.includes(property.transactionType)
  )
    return null;
  if (
    criteria.propertyTypes.length &&
    !criteria.propertyTypes.includes(property.propertyType)
  )
    return null;
  if (criteria.parkingRequired && !property.parking) return null;
  if (criteria.elevatorRequired && !property.elevator) return null;
  if (
    criteria.cities.length &&
    !criteria.cities.some(
      (item) => property.city.includes(item) || item.includes(property.city),
    )
  )
    return null;
  if (
    criteria.districts.length &&
    !criteria.districts.some(
      (item) =>
        property.district.includes(item) || item.includes(property.district),
    )
  )
    return null;

  const price = asNumber(property.priceTotal);
  const deposit = asNumber(property.depositAmount);
  const rent = asNumber(property.monthlyRent);
  if (criteria.minPrice != null && (price == null || price < criteria.minPrice))
    return null;
  if (criteria.maxPrice != null && (price == null || price > criteria.maxPrice))
    return null;
  if (
    criteria.maxDeposit != null &&
    (deposit == null || deposit > criteria.maxDeposit)
  )
    return null;
  if (
    criteria.maxMonthlyRent != null &&
    (rent == null || rent > criteria.maxMonthlyRent)
  )
    return null;
  if (criteria.minArea != null && property.area < criteria.minArea) return null;
  if (criteria.maxArea != null && property.area > criteria.maxArea) return null;
  if (
    criteria.minBedrooms != null &&
    (property.bedrooms == null || property.bedrooms < criteria.minBedrooms)
  )
    return null;
  if (
    criteria.maxBedrooms != null &&
    (property.bedrooms == null || property.bedrooms > criteria.maxBedrooms)
  )
    return null;

  let score = 45;
  if (criteria.transactionTypes.length) {
    score += 10;
    reasons.push(`معامله ${label(property.transactionType)}`);
  }
  if (criteria.propertyTypes.length) {
    score += 10;
    reasons.push(`نوع ملک ${label(property.propertyType)}`);
  }
  if (criteria.cities.length) {
    score += 10;
    reasons.push(`شهر ${property.city}`);
  }
  if (criteria.districts.length) {
    score += 5;
    reasons.push(`منطقه ${property.district}`);
  }
  if (criteria.neighborhoods.length) {
    const neighborhoodMatch = criteria.neighborhoods.some(
      (item) =>
        property.neighborhood.includes(item) ||
        item.includes(property.neighborhood),
    );
    if (!neighborhoodMatch) return null;
    score += 15;
    reasons.push(`محله ${property.neighborhood}`);
  }
  if (criteria.minArea != null || criteria.maxArea != null) {
    score += 8;
    reasons.push(`متراژ ${property.area} متر`);
  }
  if (
    criteria.minPrice != null ||
    criteria.maxPrice != null ||
    criteria.maxDeposit != null ||
    criteria.maxMonthlyRent != null
  ) {
    score += 7;
    reasons.push("بودجه سازگار");
  }
  if (criteria.parkingRequired) {
    score += 3;
    reasons.push("دارای پارکینگ");
  }
  if (criteria.elevatorRequired) {
    score += 2;
    reasons.push("دارای آسانسور");
  }
  if (criteria.keywords.length) {
    const haystack = `${property.title} ${property.description} ${property.address} ${property.neighborhood}`;
    const hits = criteria.keywords.filter((keyword) =>
      haystack.includes(keyword),
    );
    score += Math.min(10, hits.length * 3);
    reasons.push(...hits.slice(0, 2).map((keyword) => `شامل «${keyword}»`));
  }
  if (!reasons.length) reasons.push("سازگار با شرایط کلی جست‌وجو");
  return { score: Math.min(100, score), reasons };
}

export const aiSearchSystemPrompt = `شما مفسر جست‌وجوی فارسی سامانه املاک آجر برای شهرها و استان‌های سراسر ایران هستید.
متن کاربر را فقط به یک شیء JSON معتبر تبدیل کنید. هیچ متن یا markdown دیگری ننویسید.
نام شهر را در cities، منطقه شهری را در districts و نام محله را در neighborhoods قرار دهید و هیچ شهر پیش‌فرضی فرض نکنید.
مبالغ همگی تومان هستند. عبارت «میلیارد» را در 1,000,000,000 و «میلیون» را در 1,000,000 ضرب کنید.
برای خرید و پیش‌فروش از minPrice/maxPrice استفاده کنید. برای رهن و اجاره از maxDeposit و maxMonthlyRent استفاده کنید.
مقادیر enum مجاز:
transactionTypes: SALE, RENT, MORTGAGE_RENT, PRESALE
propertyTypes: APARTMENT, HOUSE, VILLA, LAND, COMMERCIAL, OFFICE, STORE, WAREHOUSE
کلیدهای خروجی دقیقاً: summary, transactionTypes, propertyTypes, cities, districts, neighborhoods, minPrice, maxPrice, maxDeposit, maxMonthlyRent, minArea, maxArea, minBedrooms, maxBedrooms, parkingRequired, elevatorRequired, keywords
برای معیارهای نامشخص آرایه خالی، false یا null بگذارید. summary یک خلاصه کوتاه فارسی از برداشت شما باشد.`;
