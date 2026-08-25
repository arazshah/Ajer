"use client";

import { ReactNode, useActionState } from "react";
import {
  type PlatformSettingsState,
  updatePlatformSettings,
} from "@/app/super-admin/actions";

export function PlatformSettingsForm({
  section,
  children,
  submitLabel = "ذخیره تنظیمات",
  className = "card p-5 md:p-6 grid gap-4",
}: {
  section: "general" | "ai" | "sms" | "payments" | "account";
  children: ReactNode;
  submitLabel?: string;
  className?: string;
}) {
  const [state, action, pending] = useActionState<
    PlatformSettingsState,
    FormData
  >(updatePlatformSettings, null);
  return (
    <form action={action} className={className}>
      <input type="hidden" name="section" value={section} />
      {children}
      {state?.error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
          {state.success}
        </p>
      )}
      <button className="btn btn-dark justify-center" disabled={pending}>
        {pending ? "در حال ذخیره…" : submitLabel}
      </button>
    </form>
  );
}
