const persianMonth = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "long",
});

function monthKey(value: Date) {
  return persianMonth.format(value);
}

export function buildSixMonthTrend(
  properties: Array<{ createdAt: Date }>,
  deals: Array<{ createdAt: Date }>,
  now = new Date(),
) {
  const months: string[] = [];
  for (let day = 0; day < 230 && months.length < 6; day += 1) {
    const date = new Date(now.getTime() - day * 86_400_000);
    const key = monthKey(date);
    if (!months.includes(key)) months.push(key);
  }
  return months.reverse().map((name) => ({
    name,
    فایل: properties.filter((item) => monthKey(item.createdAt) === name).length,
    معامله: deals.filter((item) => monthKey(item.createdAt) === name).length,
  }));
}

export function conversionRate(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1_000) / 10;
}

export function buildSalesFunnel(
  stages: Array<{ key: string; label: string; value: number }>,
) {
  const first = stages[0]?.value || 0;
  return stages.map((stage, index) => ({
    ...stage,
    fromPrevious:
      index === 0 ? 100 : conversionRate(stage.value, stages[index - 1].value),
    fromStart: index === 0 ? 100 : conversionRate(stage.value, first),
  }));
}

export function rankPerformance<
  T extends { completedDeals: number; visits: number },
>(rows: T[]) {
  return [...rows].sort(
    (left, right) =>
      right.completedDeals - left.completedDeals || right.visits - left.visits,
  );
}
