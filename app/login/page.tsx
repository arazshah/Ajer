import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { MapPin, Building2, Route, ShieldCheck } from "lucide-react";
export const metadata = { title: "ورود" };
export default async function Login() {
  if (await getSessionUser()) redirect("/dashboard");
  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-white">
      <section className="p-7 md:p-14 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-10">
            <div className="brand-mark text-white">آ</div>
            <div>
              <div className="text-2xl font-black">آجر</div>
              <div className="subtle">سامانه نقشه‌محور مدیریت املاک</div>
            </div>
          </div>
          <h1 className="text-3xl font-black mb-2">خوش آمدید</h1>
          <p className="subtle mb-7">از فایل تا قرارداد، روی نقشه</p>
          <LoginForm />
          <div className="mt-6 p-4 rounded-2xl bg-[#f8f5f0] border border-[#e7e0d7]">
            <b>دسترسی نسخه نمایشی</b>
            <div className="mt-2 text-sm grid gap-1">
              <span>
                مدیر: <span className="ltr inline-block">admin@ajer.ir</span>
              </span>
              <span>
                مشاور: <span className="ltr inline-block">agent@ajer.ir</span>
              </span>
              <span>
                رمز هر دو: <code className="ltr">Ajer123!</code>
              </span>
            </div>
            <p className="text-center subtle text-xs mt-6">
              طراحی و توسعه توسط{" "}
              <a
                className="text-brick font-bold"
                href="https://araz.me"
                target="_blank"
                rel="noreferrer"
              >
                آراز شاه‌کرمی · araz.me
              </a>
            </p>
          </div>
        </div>
      </section>
      <section className="hidden lg:flex relative overflow-hidden bg-ink text-white p-14 flex-col justify-between">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(#fff 1px,transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative">
          <span className="badge bg-white/10 text-white">
            <MapPin size={14} /> ارومیه
          </span>
          <h2 className="text-5xl font-black leading-tight mt-7 max-w-xl">
            همه فایل‌های آژانس،
            <br />
            <span className="text-[#e9926e]">در یک نگاه روی نقشه</span>
          </h2>
          <p className="text-white/65 mt-5 text-lg max-w-lg">
            مدیریت یکپارچه فایل‌های ملکی، مالکان، متقاضیان، پیگیری‌ها، بازدیدها
            و معاملات
          </p>
        </div>
        <div className="relative grid grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-white/8">
            <Building2 />
            <b className="block mt-3">فایل‌های واقعی‌نما</b>
          </div>
          <div className="p-4 rounded-2xl bg-white/8">
            <Route />
            <b className="block mt-3">تطبیق شفاف</b>
          </div>
          <div className="p-4 rounded-2xl bg-white/8">
            <ShieldCheck />
            <b className="block mt-3">دسترسی امن</b>
          </div>
        </div>
      </section>
    </main>
  );
}
