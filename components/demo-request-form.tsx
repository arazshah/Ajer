"use client";

import { useActionState } from "react";
import { ArrowLeft, CheckCircle2, LoaderCircle } from "lucide-react";
import {
  createDemoRequest,
  type DemoRequestState,
} from "@/app/marketing-actions";

export function DemoRequestForm() {
  const [state, action, pending] = useActionState<DemoRequestState, FormData>(
    createDemoRequest,
    null,
  );

  if (state?.success)
    return (
      <div className="demo-success" role="status">
        <CheckCircle2 size={44} />
        <h3>درخواست شما به دست ما رسید</h3>
        <p>{state.success}</p>
      </div>
    );

  return (
    <form id="demo-form" action={action} className="demo-form">
      <label className="demo-honeypot" aria-hidden="true">
        وب‌سایت
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label>
        <span>نام مدیر</span>
        <input name="managerName" autoComplete="name" required maxLength={80} />
      </label>
      <label>
        <span>شماره همراه</span>
        <input
          name="mobile"
          className="ltr text-right"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="۰۹۱۲۱۲۳۴۵۶۷"
          required
          maxLength={14}
        />
      </label>
      <label>
        <span>نام دفتر املاک</span>
        <input name="agencyName" required maxLength={120} />
      </label>
      <label>
        <span>شهر و منطقه</span>
        <input
          name="cityArea"
          placeholder="مثلاً ارومیه، خیابان حسنی"
          required
          maxLength={120}
        />
      </label>
      <label>
        <span>تعداد مشاوران</span>
        <input
          name="consultantCount"
          type="number"
          inputMode="numeric"
          min={1}
          max={500}
          defaultValue={3}
          required
        />
      </label>
      {state?.error && (
        <p className="demo-form-error" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn btn-primary demo-submit" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle className="animate-spin" size={18} /> در حال ثبت…
          </>
        ) : (
          <>
            درخواست دموی ۲۰ دقیقه‌ای <ArrowLeft size={18} />
          </>
        )}
      </button>
      <small>
        اطلاعات شما فقط برای هماهنگی دمو استفاده می‌شود و در اختیار دفتر دیگری
        قرار نمی‌گیرد.
      </small>
    </form>
  );
}
