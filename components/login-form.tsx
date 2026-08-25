"use client";
import { useActionState } from "react";
import { loginAction } from "@/app/actions";
import { Loader2, LogIn } from "lucide-react";
import Link from "next/link";
export function LoginForm({ demo = false }: { demo?: boolean }) {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">
          ایمیل
        </label>
        <input
          className="input ltr text-right"
          id="email"
          name="email"
          type="email"
          defaultValue={demo ? "admin@ajer.ir" : ""}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          رمز عبور
        </label>
        <input
          className="input ltr text-right"
          id="password"
          name="password"
          type="password"
          defaultValue={demo ? "Ajer123!" : ""}
          required
        />
      </div>
      {state?.error && (
        <p className="text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className="btn btn-primary w-full"
        type="submit"
      >
        {pending ? (
          <Loader2 className="animate-spin" size={18} />
        ) : (
          <LogIn size={18} />
        )}{" "}
        ورود به آجر
      </button>
      <Link href="/forgot-password" className="block text-center text-brick font-bold">
        رمز عبور را فراموش کرده‌اید؟
      </Link>
    </form>
  );
}
