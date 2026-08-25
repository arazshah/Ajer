import { formatJalaliDate, formatJalaliDateTime } from "@/lib/jalali";

const fa = new Intl.NumberFormat("fa-IR");
export const toPersianDigits = (value: string | number) =>
  String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
export const toEnglishDigits = (value: string) =>
  value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
export function formatMoney(value?: bigint | number | null) {
  return value == null ? "توافقی" : `${fa.format(value)} تومان`;
}
export function parseMoney(value: string) {
  const clean = toEnglishDigits(value).replace(/[,٬،\s]/g, "");
  return clean ? BigInt(clean) : null;
}
export function normalizeMobile(value: string) {
  let v = toEnglishDigits(value).replace(/[^0-9+]/g, "");
  if (v.startsWith("+98")) v = `0${v.slice(3)}`;
  if (v.startsWith("0098")) v = `0${v.slice(4)}`;
  if (v.length === 10 && v.startsWith("9")) v = `0${v}`;
  return v;
}
export function formatDate(value: Date | string) {
  return formatJalaliDate(value);
}
export function formatDateTime(value: Date | string) {
  return formatJalaliDateTime(value);
}
export function serializeBigInt<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
}
export function csvSafe(value: unknown) {
  const s = String(value ?? "");
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}
