"use client";

import { useActionState } from "react";
import { signupAction } from "@/app/auth-actions";
import { ArrowLeft, LoaderCircle } from "lucide-react";

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, null);
  return (
    <form action={action} className="grid gap-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <label>
          <span className="label">نام دفتر املاک</span>
          <input className="input" name="agencyName" required />
        </label>
        <label>
          <span className="label">نام مدیر دفتر</span>
          <input className="input" name="fullName" required />
        </label>
        <label>
          <span className="label">شماره همراه</span>
          <input
            className="input ltr text-right"
            name="mobile"
            inputMode="tel"
            placeholder="09123456789"
            required
          />
        </label>
        <label>
          <span className="label">ایمیل</span>
          <input
            className="input ltr text-right"
            name="email"
            type="email"
            required
          />
        </label>
        <label>
          <span className="label">شهر</span>
          <input
            className="input"
            name="city"
            placeholder="مثلاً تهران"
            required
          />
        </label>
        <label>
          <span className="label">رمز عبور</span>
          <input
            className="input ltr text-right"
            name="password"
            type="password"
            minLength={10}
            required
          />
        </label>
      </div>
      <label>
        <span className="label">نشانی دفتر</span>
        <input className="input" name="address" required />
      </label>
      {state?.error && (
        <p className="rounded-xl bg-red-50 text-red-700 p-3 text-sm">
          {state.error}
        </p>
      )}
      <button className="btn btn-primary py-3" disabled={pending}>
        {pending ? (
          <LoaderCircle className="animate-spin" size={18} />
        ) : (
          <ArrowLeft size={18} />
        )}
        ساخت حساب و شروع ۳۰ روز آزمایشی
      </button>
      <p className="text-xs subtle text-center">
        با ثبت‌نام، یک فضای خصوصی و مستقل برای دفتر شما ساخته می‌شود.
      </p>
    </form>
  );
}
