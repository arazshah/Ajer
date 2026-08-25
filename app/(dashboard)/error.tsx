"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard rendering failed", error.digest || "no-digest");
  }, [error]);
  return (
    <div className="card mx-auto max-w-2xl p-8 text-center">
      <AlertTriangle className="mx-auto text-amber-600" size={42} />
      <h1 className="mt-4 text-2xl font-black">این بخش موقتاً در دسترس نیست</h1>
      <p className="subtle mt-2">
        اطلاعات شما محفوظ است. دوباره تلاش کنید و اگر مشکل ادامه داشت، کد پیگیری را برای پشتیبانی ارسال کنید.
      </p>
      {error.digest && (
        <code className="mt-3 block text-xs text-slate-500">{error.digest}</code>
      )}
      <button className="btn btn-primary mx-auto mt-5" onClick={reset}>
        <RotateCcw size={17} /> تلاش دوباره
      </button>
    </div>
  );
}
