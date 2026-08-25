"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  CircleHelp,
  CreditCard,
  WalletCards,
  ListTodo,
  ArrowLeftRight,
  Landmark,
  CircleUserRound,
  X,
} from "lucide-react";
import { logoutAction } from "@/app/actions";
import Image from "next/image";
const nav = [
  ["/dashboard", "داشبورد", LayoutDashboard, "dashboard.view"],
  ["/map", "نقشه املاک", Map, "properties.view"],
  ["/properties", "فایل‌های ملکی", Building2, "properties.view"],
  ["/owners", "مالکان", Users, "contacts.view"],
  ["/applicants", "متقاضیان", UserRoundSearch, "contacts.view"],
  ["/matching", "تطبیق هوشمند", Sparkles, "ai.use"],
  ["/activities", "پیگیری‌ها", ClipboardCheck, "activities.manage"],
  ["/visits", "بازدیدها", CalendarDays, "visits.manage"],
  ["/tasks", "وظایف تیم", ListTodo, "activities.manage"],
  ["/offers", "پیشنهادها و مذاکره", ArrowLeftRight, "deals.view"],
  ["/deals", "معاملات", Handshake, "deals.view"],
  ["/commissions", "کمیسیون و تسویه", WalletCards, "commissions.view"],
  ["/accounting", "حسابداری دفتر", Landmark, "accounting.view"],
  ["/reports", "گزارش‌ها", ChartNoAxesCombined, "reports.view"],
  ["/users", "کاربران", UserCog, "users.manage"],
  ["/billing", "اشتراک و پرداخت", CreditCard, "settings.manage"],
  ["/profile", "پروفایل من", CircleUserRound, "dashboard.view"],
  ["/help", "راهنمای آجر", CircleHelp, "dashboard.view"],
  ["/settings", "تنظیمات", Settings, "settings.manage"],
] as const;
export function Shell({
  children,
  user,
  unread,
  access,
  permissions,
}: {
  children: React.ReactNode;
  user: { fullName: string; role: string; avatarUrl: string | null };
  unread: number;
  access: "trial" | "subscription" | "none";
  permissions: string[];
}) {
  const p = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="shell">
      {menuOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="بستن فهرست"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <button
          type="button"
          className="sidebar-close"
          onClick={() => setMenuOpen(false)}
          aria-label="بستن فهرست"
        >
          <X />
        </button>
        <Link href="/dashboard" className="flex items-center gap-3 px-2 mb-7">
          <div className="brand-mark">آ</div>
          <div>
            <div className="text-xl font-black">آجر</div>
            <small className="text-white/50">مالک و مستأجر</small>
          </div>
        </Link>
        <nav className="sidebar-nav">
          {nav
            .filter(([, , , permission]) => permissions.includes(permission))
            .map(([href, title, Icon]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`nav-link ${p.startsWith(href) ? "active" : ""}`}
              >
                <Icon size={19} />
                <span>{title}</span>
              </Link>
            ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="btn p-2 mobile-menu"
            aria-label="فهرست"
            onClick={() => setMenuOpen(true)}
          >
            <Menu />
          </button>
          {permissions.includes("properties.view") ? (
            <Link
              href="/search"
              className="top-search flex items-center gap-2 bg-[#f5f3ef] rounded-xl px-4 py-2.5 flex-1 max-w-xl text-slate-500"
            >
              <Search size={18} /> جست‌وجوی فایل، مالک یا متقاضی…
            </Link>
          ) : (
            <div className="flex-1" />
          )}
          <span
            className={`badge hidden md:inline-flex ${access === "none" ? "badge-danger" : access === "trial" ? "badge-warn" : "badge-active"}`}
          >
            {access === "trial"
              ? "دوره آزمایشی"
              : access === "subscription"
                ? "اشتراک فعال"
                : "نیازمند تمدید"}
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
              {user.avatarUrl ? (
                <Image src={user.avatarUrl} alt={user.fullName} width={36} height={36} unoptimized className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-ink text-white grid place-items-center font-bold">{user.fullName[0]}</div>
              )}
              <div className="hidden lg:block">
                <b className="text-sm block">{user.fullName}</b>
                <small className="subtle">
                  {user.role === "ADMIN" ? "مدیر دفتر" : "مشاور / بازاریاب"}
                </small>
              </div>
              <ChevronDown size={14} />
            </summary>
            <div className="absolute left-0 mt-3 card p-2 w-44 z-50">
              <Link
                href="/profile"
                className="w-full flex gap-2 p-2 hover:bg-slate-50 rounded-lg"
              >
                <CircleUserRound size={17} /> پروفایل من
              </Link>
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
        </main>
        <footer className="app-footer">
          آجر؛ مالک و مستأجر · سیستم مدیریت حرفه‌ای املاک ایران · ساخته‌شده توسط{" "}
          <a href="https://araz.me" target="_blank" rel="noreferrer">
            آراز شاه‌کرمی
          </a>
        </footer>
      </div>
    </div>
  );
}
