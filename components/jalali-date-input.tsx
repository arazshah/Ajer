import type { InputHTMLAttributes } from "react";
import { formatJalaliDateInput, formatJalaliDateTimeInput } from "@/lib/jalali";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "defaultValue"
> & {
  defaultValue?: Date | string | null;
  includeTime?: boolean;
};

export function JalaliDateInput({
  defaultValue,
  includeTime = false,
  className = "input ltr",
  placeholder,
  ...props
}: Props) {
  const formatted = defaultValue
    ? includeTime
      ? formatJalaliDateTimeInput(defaultValue)
      : formatJalaliDateInput(defaultValue)
    : undefined;
  return (
    <input
      {...props}
      className={className}
      type="text"
      dir="ltr"
      inputMode="numeric"
      autoComplete="off"
      defaultValue={formatted}
      placeholder={
        placeholder || (includeTime ? "۱۴۰۵/۰۶/۰۲ ۱۴:۳۰" : "۱۴۰۵/۰۶/۰۲")
      }
      title={includeTime ? "تاریخ و ساعت شمسی" : "تاریخ شمسی"}
    />
  );
}
