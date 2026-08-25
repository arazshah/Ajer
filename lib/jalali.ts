const persianDateParts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
  timeZone: "Asia/Tehran",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const tehranDateTimeParts = new Intl.DateTimeFormat(
  "en-US-u-ca-gregory-nu-latn",
  {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  },
);

const faDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: "Asia/Tehran",
  year: "numeric",
  month: "short",
  day: "numeric",
});

const faDateTime = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: "Asia/Tehran",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function englishDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function parts(
  formatter: Intl.DateTimeFormat,
  value: Date,
): Record<string, number> {
  return Object.fromEntries(
    formatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
}

function persianParts(value: Date) {
  return parts(persianDateParts, value);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function findGregorianDate(year: number, month: number, day: number) {
  const estimatedGregorianYear = year + 621;
  let farvardinOne: Date | null = null;
  for (let offset = 0; offset < 50; offset += 1) {
    const candidate = new Date(
      Date.UTC(estimatedGregorianYear, 2, 1 + offset, 12),
    );
    const candidateParts = persianParts(candidate);
    if (
      candidateParts.year === year &&
      candidateParts.month === 1 &&
      candidateParts.day === 1
    ) {
      farvardinOne = candidate;
      break;
    }
  }
  if (!farvardinOne) return null;
  const dayOffset =
    (month <= 6 ? (month - 1) * 31 : 186 + (month - 7) * 30) + day - 1;
  const candidate = new Date(farvardinOne.getTime() + dayOffset * 86_400_000);
  const candidateParts = persianParts(candidate);
  if (
    candidateParts.year !== year ||
    candidateParts.month !== month ||
    candidateParts.day !== day
  )
    return null;
  return {
    year: candidate.getUTCFullYear(),
    month: candidate.getUTCMonth() + 1,
    day: candidate.getUTCDate(),
  };
}

function tehranLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = new Date(desired);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const local = parts(tehranDateTimeParts, candidate);
    const representedAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    candidate = new Date(candidate.getTime() + desired - representedAsUtc);
  }
  return candidate;
}

function parse(value: string, withTime: boolean) {
  const normalized = englishDigits(value.trim())
    .replace(/[.\-]/g, "/")
    .replace(/\s+/g, " ");
  const match = normalized.match(
    /^(\d{3,4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/,
  );
  if (!match || (withTime && match[4] === undefined)) return null;
  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = hourRaw === undefined ? 12 : Number(hourRaw);
  const minute = minuteRaw === undefined ? 0 : Number(minuteRaw);
  if (
    year < 1200 ||
    year > 1600 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  )
    return null;
  const gregorian = findGregorianDate(year, month, day);
  if (!gregorian) return null;
  return tehranLocalToUtc(
    gregorian.year,
    gregorian.month,
    gregorian.day,
    hour,
    minute,
  );
}

export function parseJalaliDate(value: string) {
  return parse(value, false);
}

export function parseJalaliDateTime(value: string) {
  return parse(value, true);
}

export function formatJalaliDateInput(value: Date | string) {
  const date = new Date(value);
  const dateParts = persianParts(date);
  return `${dateParts.year}/${pad(dateParts.month)}/${pad(dateParts.day)}`;
}

export function formatJalaliDateTimeInput(value: Date | string) {
  const date = new Date(value);
  const dateParts = persianParts(date);
  const timeParts = parts(tehranDateTimeParts, date);
  return `${dateParts.year}/${pad(dateParts.month)}/${pad(dateParts.day)} ${pad(timeParts.hour)}:${pad(timeParts.minute)}`;
}

export function formatJalaliDate(value: Date | string) {
  return faDate.format(new Date(value));
}

export function formatJalaliDateTime(value: Date | string) {
  return faDateTime.format(new Date(value));
}
