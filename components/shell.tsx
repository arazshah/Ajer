"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Map,
  Building2,
  Users,
  UserRoundSearch,
  Sparkles,
  ClipboardCheck,
  CalendarDays,
  Handshake,
  ChartNoAxesCombined,
  UserCog,
  Settings,
  Search,
  Bell,
  Plus,
  Menu,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { logoutAction } from "@/app/actions";
const nav = [
  ["/dashboard", "داشبورد", LayoutDashboard],
  ["/map", "نقشه املاک", Map],
  ["/properties", "فایل‌های ملکی", Building2],
  ["/owners", "مالکان", Users],
  ["/applicants", "متقاضیان", UserRoundSearch],
  ["/matching", "تطبیق هوشمند", Sparkles],
  ["/activities", "پیگیری‌ها", ClipboardCheck],
  ["/visits", "بازدیدها", CalendarDays],
  ["/deals", "معاملات", Handshake],
  ["/reports", "گزارش‌ها", ChartNoAxesCombined],
  ["/users", "کاربران", UserCog],
  ["/settings", "تنظیمات", Settings],
] as const;
export function Shell({
  children,
  user,
  unread,
}: {
  children: React.ReactNode;
  user: { fullName: string; role: string };
  unread: number;
}) {
  const p = usePathname();
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="flex items-center gap-3 px-2 mb-7">
          <div className="brand-mark">آ</div>
          <div>
            <div className="text-xl font-black">آجر</div>
            <small className="text-white/50">مدیریت املاک</small>
          </div>
        </Link>
        <nav className="flex-1 overflow-auto">
          {nav.map(([href, title, Icon]) => (
            <Link
              key={href}
              href={href}
              className={`nav-link ${p.startsWith(href) ? "active" : ""}`}
            >
              <Icon size={19} />
              <span>{title}</span>
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 pt-4 mt-3 text-xs text-white/45 leading-6">
          تمام اطلاعات این نسخه نمایشی ساختگی است.
          <br />
          طراحی و توسعه:{" "}
          <a
            className="text-white/75 hover:text-white"
            href="https://araz.me"
            target="_blank"
            rel="noreferrer"
          >
            آراز شاه‌کرمی
          </a>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="btn p-2 mobile-menu" aria-label="فهرست">
            <Menu />
          </button>
          <Link
            href="/search"
            className="top-search flex items-center gap-2 bg-[#f5f3ef] rounded-xl px-4 py-2.5 flex-1 max-w-xl text-slate-500"
          >
            <Search size={18} /> جست‌وجوی فایل، مالک یا متقاضی…
          </Link>
          <span className="badge badge-warn hidden md:inline-flex">
            داده‌های نمایشی
          </span>
          <Link href="/properties/new" className="btn btn-primary">
            <Plus size={18} />
            <span className="hidden sm:inline">افزودن سریع</span>
          </Link>
          <Link
            href="/notifications"
            className="relative btn p-2.5"
            aria-label="اعلان‌ها"
          >
            <Bell size={19} />
            {unread > 0 && (
              <span className="absolute -top-1 -left-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full grid place-items-center">
                {unread}
              </span>
            )}
          </Link>
          <details className="relative">
            <summary className="list-none cursor-pointer flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-ink text-white grid place-items-center font-bold">
                {user.fullName[0]}
              </div>
              <div className="hidden lg:block">
                <b className="text-sm block">{user.fullName}</b>
                <small className="subtle">
                  {user.role === "ADMIN" ? "مدیر سامانه" : "مشاور"}
                </small>
              </div>
              <ChevronDown size={14} />
            </summary>
            <div className="absolute left-0 mt-3 card p-2 w-44 z-50">
              <form action={logoutAction}>
                <button className="w-full flex gap-2 p-2 hover:bg-slate-50 rounded-lg text-red-600">
                  <LogOut size={17} /> خروج
                </button>
              </form>
            </div>
          </details>
        </header>
        <main className="content">
          {children}
          <footer className="text-center subtle text-xs py-8">
            آجر؛ از فایل تا قرارداد، روی نقشه · تمام اطلاعات این نسخه نمایشی
            ساختگی است. · ساخته‌شده توسط{" "}
            <a
              className="text-brick font-bold"
              href="https://araz.me"
              target="_blank"
              rel="noreferrer"
            >
              آراز شاه‌کرمی
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
