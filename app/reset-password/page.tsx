import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { resetPasswordWithSms } from "@/app/password-reset-actions";

export const metadata = { title: "ثبت رمز جدید" };
export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ email?: string; mobile?: string; sent?: string; error?: string; reason?: string }> }) {
  const query = await searchParams;
  const error = query.reason === "rate" ? "تلاش‌های زیادی انجام شده است؛ بعداً دوباره اقدام کنید." : query.reason === "code" ? "کد نادرست یا منقضی شده است. در صورت نیاز کد تازه بگیرید." : query.error ? "کد و رمز جدید را مطابق راهنما وارد کنید." : null;
  return <main className="min-h-screen bg-cream grid place-items-center p-5"><section className="card p-6 md:p-8 w-full max-w-md">
    <div className="feature-icon mb-4"><ShieldCheck /></div><h1 className="text-2xl font-black">ثبت رمز جدید</h1>
    <p className="subtle mt-2 mb-5">کد پیامک‌شده ۱۰ دقیقه اعتبار دارد و پس از استفاده باطل می‌شود.</p>
    {query.sent && <div className="toast-note text-green-700 mb-4">اگر اطلاعات با حسابی منطبق باشد، کد بازیابی ارسال شده است.</div>}
    {error && <div className="toast-note text-red-700 mb-4">{error}</div>}
    <form action={resetPasswordWithSms} className="grid gap-4">
      <input type="hidden" name="email" value={query.email || ""} /><input type="hidden" name="mobile" value={query.mobile || ""} />
      <label><span className="label">کد ۶ رقمی</span><input className="input ltr text-center text-xl tracking-[.35em]" name="code" inputMode="numeric" maxLength={6} autoComplete="one-time-code" required /></label>
      <label><span className="label">رمز جدید</span><input className="input ltr text-right" name="password" type="password" autoComplete="new-password" required /></label>
      <label><span className="label">تکرار رمز جدید</span><input className="input ltr text-right" name="confirmation" type="password" autoComplete="new-password" required /></label>
      <small className="subtle">حداقل ۱۰ نویسه، شامل حرف انگلیسی، عدد و نویسه ویژه</small><button className="btn btn-primary">ثبت رمز جدید</button>
    </form><Link href="/forgot-password" className="block text-center mt-5 text-brick font-bold">دریافت کد تازه</Link>
  </section></main>;
}
