import { createHash } from "node:crypto";
import { toEnglishDigits } from "./format";

export function normalizeNationalCode(value: string) {
  return toEnglishDigits(value).replace(/\D/g, "").slice(0, 10);
}

export function normalizeCrmText(value: string) {
  return toEnglishDigits(value)
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[،,;؛._\-/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function propertyFingerprint(input: {
  ownerId: string;
  propertyType: string;
  address: string;
  area: number;
}) {
  const canonical = [
    input.ownerId,
    input.propertyType,
    normalizeCrmText(input.address),
    Math.round(input.area * 100) / 100,
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

export function parseTags(value: string) {
  return [
    ...new Set(
      value
        .split(/[,،]/)
        .map(normalizeCrmText)
        .filter((tag) => tag.length >= 2)
        .map((tag) => tag.slice(0, 40)),
    ),
  ].slice(0, 10);
}
