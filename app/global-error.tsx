"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <main className="min-h-screen grid place-items-center bg-[#f7f5f1] p-6">
          <section className="card max-w-xl p-8 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brick text-2xl font-black text-white">
              آ
            </div>
            <h1 className="mt-4 text-2xl font-black">آجر با یک خطای پیش‌بینی‌نشده روبه‌رو شد</h1>
            <p className="subtle mt-2">اطلاعات ذخیره‌شده حذف نشده است؛ صفحه را دوباره بارگذاری کنید.</p>
            {error.digest && <code className="mt-3 block text-xs">{error.digest}</code>}
            <button className="btn btn-primary mx-auto mt-5" onClick={reset}>
              تلاش دوباره
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
