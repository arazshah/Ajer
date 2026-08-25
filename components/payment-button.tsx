"use client";

import { useActionState } from "react";
import { startPaymentAction } from "@/app/billing-actions";
import { CreditCard, LoaderCircle } from "lucide-react";

export function PaymentButton({ planId }: { planId: string }) {
  const [state, action, pending] = useActionState(startPaymentAction, null);
  return (
    <form action={action} className="grid gap-3 mt-5">
      <input type="hidden" name="planId" value={planId} />
      <label className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3 cursor-pointer">
        <input
          className="mt-1 accent-[#c65d35]"
          type="checkbox"
          name="aiEnabled"
        />
        <span>
          <b className="block">افزودن دستیار هوشمند</b>
          <small className="subtle">
            جست‌وجوی طبیعی و پیشنهاد فایل دقیق‌تر
          </small>
        </span>
      </label>
      {state?.error && <p className="text-red-700 text-xs">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>
        {pending ? (
          <LoaderCircle className="animate-spin" size={18} />
        ) : (
          <CreditCard size={18} />
        )}
        پرداخت امن با زرین‌پال
      </button>
    </form>
  );
}
