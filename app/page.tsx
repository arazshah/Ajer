import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Building2,
  Check,
  CircleCheck,
  Handshake,
  MapPinned,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import { DEFAULT_PLANS, formatToman } from "@/lib/plans";

const features = [
  [
    MapPinned,
    "مدیریت نقشه‌محور",
    "فایل‌ها را روی نقشه ببینید و محدوده‌های مناسب مشتری را سریع پیدا کنید.",
  ],
  [
    Workflow,
    "از فایل تا قرارداد",
    "مالک، متقاضی، پیگیری، بازدید و معامله در یک گردش‌کار منظم کنار هم هستند.",
  ],
  [
    Bot,
    "دستیار هوشمند",
    "شرایط مشتری را طبیعی بنویسید تا آجر مرتبط‌ترین فایل‌های دفتر خودتان را پیشنهاد کند.",
  ],
  [
    Users,
    "کاربران نامحدود",
    "برای همه مشاوران و بازاریاب‌های دفتر حساب مستقل و سطح دسترسی بسازید.",
  ],
  [
    ShieldCheck,
    "فضای کاملاً خصوصی",
    "داده‌های هر دفتر از تمام دفاتر دیگر جداست و فقط اعضای همان دفتر به آن دسترسی دارند.",
  ],
  [
    Handshake,
    "مدیریت درآمد دفتر",
    "معاملات، کمیسیون‌ها و عملکرد تیم را با گزارش‌های کاربردی دنبال کنید.",
  ],
] as const;

export default function Home() {
  return (
    <main className="landing min-h-screen bg-[#fbfaf7] overflow-hidden">
      <header className="landing-nav">
        <Link href="/" className="flex items-center gap-3">
          <span className="brand-mark text-white">آ</span>
          <span>
            <b className="text-xl block">آجر</b>
            <small className="subtle">مالک و مستأجر</small>
          </span>
        </Link>
        <nav className="hidden md:flex gap-7 text-sm font-bold text-slate-600">
          <a href="#features">امکانات</a>
          <a href="#name-story">چرا آجر؟</a>
          <a href="#security">امنیت</a>
          <a href="#pricing">تعرفه‌ها</a>
          <a href="#how">نحوه شروع</a>
        </nav>
        <div className="flex gap-2">
          <Link href="/login" className="btn hidden sm:inline-flex">
            ورود
          </Link>
          <Link href="/signup" className="btn btn-primary">
            ۳۰ روز رایگان <ArrowLeft size={17} />
          </Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="relative z-10">
          <span className="hero-pill">
            <Sparkles size={16} /> ساخته‌شده برای مشاوران املاک سراسر ایران
          </span>
          <h1>
            دفتر املاک شما،
            <br />
            <span>منظم‌تر، سریع‌تر، پرفروش‌تر.</span>
          </h1>
          <p>
            آجر سیستم عملیاتی کامل دفتر املاک است؛ از اجاره، رهن و فروش تا
            پیش‌فروش، ساخت‌وساز، قرارداد، کمیسیون و مدیریت تیم در یک فضای امن و
            هوشمند.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link
              href="/signup"
              className="btn btn-primary text-base px-6 py-3"
            >
              شروع رایگان بدون کارت بانکی <ArrowLeft size={19} />
            </Link>
            <a href="#features" className="btn text-base px-6 py-3">
              دیدن امکانات
            </a>
          </div>
          <div className="flex flex-wrap gap-5 mt-7 text-sm text-slate-600">
            <span>
              <CircleCheck size={17} /> ۳۰ روز آزمایشی کامل
            </span>
            <span>
              <CircleCheck size={17} /> کاربران نامحدود
            </span>
            <span>
              <CircleCheck size={17} /> لغو در هر زمان
            </span>
          </div>
        </div>
        <div className="hero-product relative z-10">
          <div className="mock-window">
            <div className="mock-top">
              <span />
              <span />
              <span />
              <b>داشبورد آجر</b>
            </div>
            <div className="mock-body">
              <aside>
                <div className="mock-logo">آ</div>
                {[1, 2, 3, 4, 5, 6].map((x) => (
                  <i key={x} />
                ))}
              </aside>
              <div className="mock-content">
                <div className="flex justify-between items-center">
                  <div>
                    <b className="text-xl">صبح بخیر، آقای محمدی</b>
                    <small className="block subtle mt-1">
                      نبض امروز دفتر شما
                    </small>
                  </div>
                  <span className="badge badge-active">اشتراک فعال</span>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-5">
                  <div className="mock-stat">
                    <small>فایل فعال</small>
                    <b>۱۴۸</b>
                  </div>
                  <div className="mock-stat">
                    <small>پیگیری امروز</small>
                    <b>۲۱</b>
                  </div>
                  <div className="mock-stat">
                    <small>بازدید هفته</small>
                    <b>۱۲</b>
                  </div>
                </div>
                <div className="mock-ai">
                  <Bot size={22} />
                  <div>
                    <b>جست‌وجوی هوشمند</b>
                    <p>«آپارتمان دوخواب تا ۶ میلیارد، پارکینگ‌دار…»</p>
                  </div>
                  <span>۷ پیشنهاد</span>
                </div>
                <div className="mock-map">
                  <MapPinned size={42} />
                  <span className="pin one" />
                  <span className="pin two" />
                  <span className="pin three" />
                </div>
              </div>
            </div>
          </div>
          <div className="floating-card">
            <CircleCheck className="text-emerald-600" />
            <span>
              <b>تطبیق جدید پیدا شد</b>
              <small>۷ فایل مناسب برای متقاضی</small>
            </span>
          </div>
        </div>
      </section>

      <section className="trust-strip">
        <b>یک ابزار برای تمام تیم</b>
        <span>مدیر دفتر</span>
        <span>مدیر داخلی</span>
        <span>مشاور</span>
        <span>بازاریاب</span>
        <span>کارشناس قرارداد</span>
      </section>
      <section id="name-story" className="name-story">
        <div className="name-story-copy">
          <span className="hero-pill">یک نام با معنایی که فراموش نمی‌شود</span>
          <h2>چرا اسمش «آجر» است؟</h2>
          <p>
            «آ» از دل <b>مالک</b> می‌آید و «جر» از دل <b>مستأجر</b>. این دو کنار
            هم می‌شوند «آجر»؛ همان چیزی که خانه و کسب‌وکار ملکی را می‌سازد و
            مالک، متقاضی و دفتر املاک را به هم پیوند می‌دهد.
          </p>
          <p className="name-story-note">
            آجر فقط برای اجاره نیست؛ فروش، رهن، پیش‌فروش، مشارکت، ساخت‌وساز،
            فایل‌یابی، بازدید، قرارداد و کمیسیون همه در قلمرو آجر هستند.
          </p>
        </div>
        <div
          className="name-equation"
          aria-label="آ از مالک به‌علاوه جر از مستأجر برابر آجر"
        >
          <div className="source-word">
            <span className="removed">م</span>
            <strong>آ</strong>
            <span className="removed">لک</span>
            <small>از مالک</small>
          </div>
          <span className="equation-sign">+</span>
          <div className="source-word">
            <span className="removed">مستا</span>
            <strong>جر</strong>
            <small>از مستأجر</small>
          </div>
          <span className="equation-sign">=</span>
          <div className="ajer-result">
            <b>آجر</b>
            <small>خانه‌ی همه معاملات ملکی</small>
          </div>
        </div>
      </section>
      <section id="features" className="landing-section">
        <div className="landing-heading">
          <span>همه‌چیز یکجا</span>
          <h2>هر چیزی که یک دفتر حرفه‌ای نیاز دارد</h2>
          <p>
            به‌جای دفتر کاغذی، اکسل و پیام‌های پراکنده؛ یک جریان کاری شفاف و
            قابل پیگیری بسازید.
          </p>
        </div>
        <div className="feature-grid">
          {features.map(([Icon, title, desc]) => (
            <article key={title}>
              <div className="feature-icon">
                <Icon />
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>
      </section>
      <section id="security" className="privacy-section">
        <div>
          <span className="hero-pill">
            <ShieldCheck size={16} /> حریم داده از پایه
          </span>
          <h2>اطلاعات دفتر شما فقط برای خود شماست.</h2>
          <p>
            هر ثبت‌نام یک فضای مستقل می‌سازد. تمام فایل‌ها، مالکان، متقاضیان،
            کاربران و گزارش‌ها با شناسه همان دفتر محدود می‌شوند؛ هیچ مشاور
            املاکی نمی‌تواند اطلاعات دفتر دیگری را ببیند.
          </p>
          <ul>
            <li>
              <Check /> جداسازی داده در تمام جست‌وجوها و عملیات
            </li>
            <li>
              <Check /> کلیدهای پرداخت، پیامک و AI فقط در سرور
            </li>
            <li>
              <Check /> گزارش فعالیت و سطح دسترسی کاربران
            </li>
          </ul>
        </div>
        <div className="privacy-visual">
          <div className="vault">
            <ShieldCheck size={54} />
            <b>فضای خصوصی دفتر شما</b>
            <small>داده‌های مستقل و محافظت‌شده</small>
          </div>
          <div className="blocked">
            دفترهای دیگر <b>بدون دسترسی</b>
          </div>
        </div>
      </section>
      <section id="pricing" className="landing-section bg-white rounded-[40px]">
        <div className="landing-heading">
          <span>قیمت شفاف</span>
          <h2>یک دفتر، کاربران نامحدود</h2>
          <p>
            ۳۰ روز اول رایگان است. سپس دوره مناسب خود را انتخاب کنید؛ دستیار
            هوشمند یک افزونه اختیاری است.
          </p>
        </div>
        <div className="pricing-grid">
          {DEFAULT_PLANS.map((plan) => (
            <article
              className={plan.isFeatured ? "featured" : ""}
              key={plan.code}
            >
              {plan.isFeatured && <span className="popular">پیشنهاد آجر</span>}
              <h3>{plan.title}</h3>
              <p>{plan.description}</p>
              <strong>{formatToman(plan.basePriceToman)}</strong>
              <small>برای کل دفتر · کاربران نامحدود</small>
              {plan.discountPercent > 0 && (
                <span className="discount">{plan.discountPercent}٪ تخفیف</span>
              )}
              <ul>
                <li>
                  <Check /> تمام امکانات مدیریت املاک
                </li>
                <li>
                  <Check /> فضای خصوصی مستقل
                </li>
                <li>
                  <Check /> افزونه AI اختیاری
                </li>
              </ul>
              <Link href="/signup" className="btn btn-primary w-full">
                شروع رایگان
              </Link>
            </article>
          ))}
        </div>
        <p className="text-center subtle mt-6">
          افزونه AI از ماهی ۲۰۰ هزار تومان محاسبه و در دوره‌های بلندمدت شامل
          همان تخفیف می‌شود.
        </p>
      </section>
      <section id="how" className="landing-section">
        <div className="landing-heading">
          <span>شروع ساده</span>
          <h2>در سه قدم دفترتان را متحول کنید</h2>
        </div>
        <div className="steps">
          <article>
            <b>۱</b>
            <h3>ثبت‌نام دفتر</h3>
            <p>
              اطلاعات مدیر و دفتر را وارد کنید؛ فضای خصوصی شما فوری ساخته
              می‌شود.
            </p>
          </article>
          <article>
            <b>۲</b>
            <h3>دعوت از تیم</h3>
            <p>
              هر تعداد مشاور یا بازاریاب که دارید با سطح دسترسی مناسب اضافه
              کنید.
            </p>
          </article>
          <article>
            <b>۳</b>
            <h3>ثبت فایل و فروش</h3>
            <p>
              اطلاعات را وارد کنید، تطبیق‌ها را ببینید و هیچ پیگیری را از دست
              ندهید.
            </p>
          </article>
        </div>
      </section>
      <section className="final-cta">
        <Building2 size={48} />
        <h2>آماده‌اید دفتر املاک حرفه‌ای‌تری بسازید؟</h2>
        <p>۳۰ روز با همه امکانات آجر کار کنید؛ بدون نیاز به پرداخت اولیه.</p>
        <Link
          href="/signup"
          className="btn bg-white text-slate-900 border-white px-7 py-3"
        >
          همین حالا رایگان شروع کنید <ArrowLeft />
        </Link>
      </section>
      <footer className="landing-footer">
        <div>
          <b>آجر · مالک و مستأجر</b>
          <p>سیستم مدیریت حرفه‌ای مشاوران املاک ایران</p>
        </div>
        <div className="flex gap-5">
          <Link href="/login">ورود</Link>
          <Link href="/signup">ثبت‌نام</Link>
          <a href="#pricing">تعرفه‌ها</a>
        </div>
        <p>
          طراحی و توسعه توسط{" "}
          <a href="https://araz.me" target="_blank" rel="noreferrer">
            آراز شاه‌کرمی · araz.me
          </a>
        </p>
      </footer>
    </main>
  );
}
