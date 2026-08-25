import Link from "next/link";
import { ArrowRight, KeyRound } from "lucide-react";
import { requestPasswordReset } from "@/app/password-reset-actions";

export const metadata = { title: "بازیابی رمز عبور" };
export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  const error = query.error === "rate" ? "درخواست‌های زیادی ثبت شده است؛ ۱۵ دقیقه بعد دوباره تلاش کنید." : query.error === "sms" ? "ارسال پیامک انجام نشد. تنظیمات SMS.ir یا قالب بازیابی رمز را بررسی کنید." : query.error ? "ایمیل و شماره موبایل را صحیح وارد کنید." : null;
  return <main className="min-h-screen bg-cream grid place-items-center p-5"><section className="card p-6 md:p-8 w-full max-w-md">
    <div className="feature-icon mb-4"><KeyRound /></div><h1 className="text-2xl font-black">بازیابی رمز عبور</h1>
    <p className="subtle mt-2 mb-6">ایمیل ورود و موبایل ثبت‌شده را وارد کنید؛ کد یک‌بارمصرف با پیامک ارسال می‌شود.</p>
    {error && <div className="toast-note text-red-700 mb-4">{error}</div>}
    <form action={requestPasswordReset} className="grid gap-4">
      <label><span className="label">ایمیل ورود</span><input className="input ltr text-right" name="email" type="email" required /></label>
      <label><span className="label">شماره موبایل</span><input className="input ltr text-right" name="mobile" inputMode="tel" placeholder="09123456789" required /></label>
      <button className="btn btn-primary">ارسال کد بازیابی</button>
    </form><Link href="/login" className="flex items-center justify-center gap-2 mt-5 text-brick font-bold"><ArrowRight size={16} /> بازگشت به ورود</Link>
  </section></main>;
}
