export const DEFAULT_PLANS = [
  {
    code: "MONTHLY",
    title: "یک‌ماهه",
    months: 1,
    basePriceToman: 300_000,
    aiPriceToman: 200_000,
    discountPercent: 0,
    description: "شروع منعطف و تمدید ماه‌به‌ماه",
    isFeatured: false,
    sortOrder: 1,
  },
  {
    code: "QUARTERLY",
    title: "سه‌ماهه",
    months: 3,
    basePriceToman: 855_000,
    aiPriceToman: 570_000,
    discountPercent: 5,
    description: "۵٪ تخفیف برای تیم‌های در حال رشد",
    isFeatured: false,
    sortOrder: 2,
  },
  {
    code: "SEMIANNUAL",
    title: "شش‌ماهه",
    months: 6,
    basePriceToman: 1_620_000,
    aiPriceToman: 1_080_000,
    discountPercent: 10,
    description: "۱۰٪ تخفیف و برنامه‌ریزی بلندمدت‌تر",
    isFeatured: true,
    sortOrder: 3,
  },
  {
    code: "ANNUAL",
    title: "یک‌ساله",
    months: 12,
    basePriceToman: 2_880_000,
    aiPriceToman: 1_920_000,
    discountPercent: 20,
    description: "بیشترین صرفه‌جویی با ۲۰٪ تخفیف",
    isFeatured: false,
    sortOrder: 4,
  },
] as const;

export function formatToman(value: number) {
  return `${new Intl.NumberFormat("fa-IR").format(value)} تومان`;
}

export function addMonths(date: Date, months: number) {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}
