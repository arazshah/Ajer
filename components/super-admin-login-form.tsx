"use client";

import { useActionState } from "react";
import { superAdminLoginAction } from "@/app/super-admin/actions";

export function SuperAdminLoginForm() {
  const [state, action, pending] = useActionState(superAdminLoginAction, null);
  return (
    <form action={action} className="grid gap-4">
      <label>
        <span className="label">ایمیل مدیریت کل</span>
        <input
          name="email"
          type="email"
          className="input ltr text-right"
          required
        />
      </label>
      <label>
        <span className="label">رمز عبور</span>
        <input
          name="password"
          type="password"
          className="input ltr text-right"
          required
        />
      </label>
      {state?.error && (
        <p className="text-red-700 bg-red-50 p-3 rounded-xl">{state.error}</p>
      )}
      <button className="btn btn-dark" disabled={pending}>
        {pending ? "در حال بررسی…" : "ورود امن"}
      </button>
    </form>
  );
}
