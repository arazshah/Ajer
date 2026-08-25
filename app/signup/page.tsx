import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/signup-form";
import { getSessionUser } from "@/lib/auth";
import { Check, ShieldCheck, Sparkles, Users } from "lucide-react";
import { getPlatformSettings } from "@/lib/platform-settings";

export const metadata = { title: "ثبت‌نام رایگان" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getSessionUser()) redirect("/dashboard");
  const { platform } = await getPlatformSettings();
  return (
    <main className="min-h-screen grid lg:grid-cols-[.9fr_1.1fr] bg-white">
      <section className="signup-aside">
        <Link href="/" className="flex items-center gap-3 relative z-10">
          <span className="brand-mark text-white">آ</span>
          <span>
            <b className="text-2xl">آجر</b>
            <small className="block text-white/60">مالک و مستأجر</small>
          </span>
        </Link>
        <div className="relative z-10 my-auto">
          <span className="hero-pill bg-white/10 text-white">
            <Sparkles size={16} /> {platform.trialDays} روز مهمان آجر باشید
          </span>
          <h1 className="text-4xl md:text-5xl font-black leading-tight mt-6">
            دفتر شما،
            <br />
            با نظم یک تیم حرفه‌ای
          </h1>
          <p className="text-white/65 text-lg mt-5">
            بدون کارت بانکی شروع کنید و همه قابلیت‌ها، از نقشه تا هوش مصنوعی، را
            {platform.trialDays} روز بسنجید.
          </p>
          <ul className="signup-benefits">
            <li>
              <Check /> کاربران و بازاریاب نامحدود
            </li>
            <li>
              <ShieldCheck /> فضای داده کاملاً مستقل
            </li>
            <li>
              <Users /> مناسب دفاتر سراسر ایران
            </li>
          </ul>
        </div>
        <p className="relative z-10 text-white/45 text-xs">
          ساخته‌شده توسط <a href="https://araz.me">آراز شاه‌کرمی</a>
        </p>
      </section>
      <section className="p-6 md:p-12 flex items-center justify-center">
        <div className="w-full max-w-2xl">
          <div className="mb-8">
            <h2 className="text-3xl font-black">ساخت حساب مدیر دفتر</h2>
            <p className="subtle mt-2">
              کمتر از دو دقیقه تا شروع مدیریت حرفه‌ای
            </p>
          </div>
          {platform.signupEnabled ? (
            <SignupForm />
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
              ثبت‌نام جدید موقتاً غیرفعال است. برای شروع همکاری با پشتیبانی تماس
              بگیرید.
              {(platform.supportPhone || platform.supportEmail) && (
                <span className="mt-2 block font-bold ltr text-right">
                  {platform.supportPhone || platform.supportEmail}
                </span>
              )}
            </div>
          )}
          <p className="text-center mt-6">
            قبلاً ثبت‌نام کرده‌اید؟{" "}
            <Link className="text-brick font-bold" href="/login">
              وارد شوید
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
