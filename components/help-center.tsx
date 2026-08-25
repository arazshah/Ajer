"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowUpLeft,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  FileCheck2,
  Handshake,
  Landmark,
  Lightbulb,
  ListChecks,
  PlayCircle,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRoundSearch,
  Users,
  WalletCards,
  X,
} from "lucide-react";

type Guide = {
  id: string;
  category: string;
  title: string;
  summary: string;
  duration: string;
  icon: LucideIcon;
  href: string;
  permission: string;
  keywords: string;
  outcome: string;
  warning?: string;
  steps: Array<{ title: string; text: string }>;
};

const guides: Guide[] = [
  {
    id: "setup",
    category: "شروع کار",
    title: "راه‌اندازی دفتر و تنظیمات اولیه",
    summary:
      "نام دفتر، مرکز نقشه، پیشوند فایل و حساب‌های پرسنل را پیش از ورود اطلاعات آماده کنید.",
    duration: "۸ دقیقه",
    icon: Settings,
    href: "/settings",
    permission: "settings.manage",
    keywords: "تنظیم دفتر نقشه پیشوند شهر ارز کاربر پرسنل دسترسی",
    outcome: "دفتر شما برای ثبت اطلاعات واقعی و کار تیمی آماده می‌شود.",
    warning:
      "فقط مدیر دفتر به تنظیمات و ساخت کاربران دسترسی دارد. برای هر نفر حساب مستقل بسازید و رمز مشترک استفاده نکنید.",
    steps: [
      {
        title: "مشخصات دفتر را تکمیل کنید",
        text: "در تنظیمات، نام آژانس، تلفن، شهر و نشانی را وارد کنید تا در پرونده‌ها و خروجی‌ها هویت دفتر درست نمایش داده شود.",
      },
      {
        title: "مرکز نقشه را تعیین کنید",
        text: "عرض و طول جغرافیایی و بزرگ‌نمایی پیش‌فرض را روی محدوده اصلی فعالیت دفتر بگذارید تا نقشه هنگام ثبت فایل از همان منطقه باز شود.",
      },
      {
        title: "پیشوند کد فایل را انتخاب کنید",
        text: "یک پیشوند کوتاه و ثابت مانند AJ تعیین کنید. آجر کد فایل‌های بعدی را بر همان اساس مدیریت می‌کند.",
      },
      {
        title: "پرسنل و سطح دسترسی را بسازید",
        text: "در کاربران، نقش، نوع همکاری، مدیر مستقیم و درصد پیش‌فرض کمیسیون را ثبت و با دکمه سپر فقط مجوزهای لازم را فعال کنید.",
      },
    ],
  },
  {
    id: "contacts",
    category: "اطلاعات پایه",
    title: "ثبت مالک و متقاضی حرفه‌ای",
    summary:
      "مخاطب را یک‌بار و دقیق بسازید تا تماس‌ها، فایل‌ها، نیازها، بازدیدها و معاملات به او متصل بمانند.",
    duration: "۶ دقیقه",
    icon: Users,
    href: "/owners",
    permission: "contacts.view",
    keywords: "مالک متقاضی مخاطب موبایل کد ملی نیاز بودجه محله سرنخ رضایت",
    outcome:
      "برای هر شخص یک پرونده ۳۶۰ درجه با تاریخچه کامل ارتباطات خواهید داشت.",
    warning:
      "شماره همراه و کد ملی در هر دفتر یکتا هستند. پیش از ثبت مخاطب جدید، جست‌وجو کنید تا پرونده تکراری نسازید.",
    steps: [
      {
        title: "نوع مخاطب را مشخص کنید",
        text: "شخص می‌تواند مالک، متقاضی یا هر دو باشد. نام کامل، موبایل، کد ملی و کانال آشنایی را با دقت وارد کنید.",
      },
      {
        title: "مسئول ارتباط را تعیین کنید",
        text: "مخاطب را به مشاور مسئول بسپارید و وضعیت و امتیاز سرنخ را ثبت کنید تا مدیر دفتر توزیع فرصت‌ها را ببیند.",
      },
      {
        title: "نیاز متقاضی را ثبت کنید",
        text: "نوع معامله، نوع ملک، شهر و محله‌ها، بودجه، متراژ، تعداد خواب و امکانات ضروری را در نیاز فعال وارد کنید.",
      },
      {
        title: "مدارک و رضایت ارتباط را مدیریت کنید",
        text: "مدارک هویتی حساس را در پرونده خصوصی بارگذاری و رضایت دریافت پیام و تماس را مطابق درخواست مخاطب ثبت کنید.",
      },
    ],
  },
  {
    id: "property",
    category: "اطلاعات پایه",
    title: "ثبت کامل فایل ملکی و رسانه‌ها",
    summary:
      "از مالک و نوع معامله تا قیمت، مختصات، تصاویر، پلان، ویدئو و مدارک را در یک پرونده ثبت کنید.",
    duration: "۱۰ دقیقه",
    icon: Building2,
    href: "/properties/new",
    permission: "properties.create",
    keywords: "ملک فایل تصویر پلان ویدیو سند قیمت فروش اجاره رهن نقشه آدرس",
    outcome:
      "یک فایل قابل جست‌وجو، نمایش روی نقشه و آماده ارائه به متقاضی خواهید داشت.",
    warning:
      "تصویر اصلی را حتماً مشخص کنید و مختصات دقیق را با کلیک روی نقشه تأیید کنید؛ فایل بدون موقعیت صحیح در جست‌وجوی محدوده‌ای ضعیف عمل می‌کند.",
    steps: [
      {
        title: "مالک و نوع پرونده را انتخاب کنید",
        text: "ابتدا مالک را بسازید؛ سپس نوع معامله مانند فروش، اجاره، رهن یا پیش‌فروش و نوع ملک را تعیین کنید.",
      },
      {
        title: "موقعیت و مشخصات فنی را وارد کنید",
        text: "شهر، محله و نشانی را بنویسید، محدوده پیشنهادی را روی نقشه ببینید و نقطه دقیق ملک را انتخاب کنید. متراژ، طبقه، سال ساخت و امکانات را کامل کنید.",
      },
      {
        title: "قیمت متناسب با معامله ثبت کنید",
        text: "برای فروش قیمت کل یا متری و برای اجاره ودیعه و اجاره ماهانه را وارد کنید. «توافقی» را فقط وقتی استفاده کنید که واقعاً قیمت تعیین نشده است.",
      },
      {
        title: "تصاویر و مدارک را مرتب کنید",
        text: "تصاویر، پلان و ویدئو را بارگذاری، پیش‌نمایش و مرتب کنید؛ بهترین تصویر را اصلی بگذارید و مدارک مالکیت را در بخش خصوصی نگه دارید.",
      },
    ],
  },
  {
    id: "search-match",
    category: "بازاریابی",
    title: "جست‌وجو، نقشه و تطبیق هوشمند",
    summary:
      "فایل مناسب را با فیلتر دقیق، محدوده نقشه یا توضیح زبان طبیعی پیدا و به متقاضی متصل کنید.",
    duration: "۵ دقیقه",
    icon: Sparkles,
    href: "/matching",
    permission: "ai.use",
    keywords: "جستجو هوش مصنوعی ai تطبیق نقشه شعاع بودجه محله متقاضی",
    outcome:
      "به‌جای مرور دستی همه فایل‌ها، فهرست کوتاه و مرتبط برای هر متقاضی می‌سازید.",
    warning:
      "هوش مصنوعی فقط شرایط متن را استخراج می‌کند؛ نتیجه نهایی از داده‌های خصوصی همان دفتر به دست می‌آید. همیشه جزئیات فایل را پیش از معرفی کنترل کنید.",
    steps: [
      {
        title: "نیاز فعال را انتخاب کنید",
        text: "از تطبیق هوشمند، متقاضی و نیاز ثبت‌شده او را انتخاب کنید تا بودجه، محله و امکانات مبنای مقایسه باشند.",
      },
      {
        title: "شرایط را طبیعی بنویسید",
        text: "مثلاً بنویسید: «آپارتمان دوخوابه در محدوده فرهنگ، آسانسور و پارکینگ، تا پنج میلیارد». سامانه معیارها را استخراج می‌کند.",
      },
      {
        title: "نتیجه‌ها را مقایسه کنید",
        text: "قیمت، فاصله، امکانات و وضعیت فایل‌ها را کنار هم ببینید. برای کنترل جغرافیایی از نقشه و شعاع جست‌وجو کمک بگیرید.",
      },
      {
        title: "گزینه منتخب را وارد پیگیری کنید",
        text: "پس از انتخاب گزینه مناسب، تماس یا معرفی را ثبت و در صورت علاقه متقاضی، بازدید زمان‌دار بسازید.",
      },
    ],
  },
  {
    id: "followups",
    category: "عملیات روزانه",
    title: "پیگیری‌ها و وظایف تیم",
    summary:
      "هر تماس، پیام، نتیجه و اقدام بعدی را ثبت کنید تا هیچ فرصت یا تعهدی فراموش نشود.",
    duration: "۵ دقیقه",
    icon: ClipboardCheck,
    href: "/activities",
    permission: "activities.manage",
    keywords: "پیگیری تماس پیام یادداشت وظیفه تیم سررسید اولویت اعلان",
    outcome:
      "داشبورد هر کاربر برنامه واقعی روز و موارد عقب‌افتاده را به‌درستی نشان می‌دهد.",
    warning:
      "برای پیگیری، تاریخ اقدام بعدی الزامی است اما ساعت الزامی نیست. ساعت دقیق فقط برای بازدید اهمیت عملیاتی دارد.",
    steps: [
      {
        title: "نتیجه ارتباط را همان لحظه ثبت کنید",
        text: "موضوع، شرح نتیجه، مخاطب و در صورت نیاز ملک مرتبط را انتخاب کنید. یادداشت مبهمی مثل «تماس شد» برای نفر بعدی مفید نیست.",
      },
      {
        title: "اقدام بعدی واقعی تعیین کنید",
        text: "تاریخی انتخاب کنید که واقعاً باید تماس یا بررسی انجام شود. پیگیری‌های گذشته به‌صورت هشدار در داشبورد دیده می‌شوند.",
      },
      {
        title: "وظیفه تیمی بسازید",
        text: "برای کارهای قابل واگذاری، مسئول، اولویت، سررسید و پرونده مرتبط را مشخص کنید. مسئول اعلان دریافت می‌کند.",
      },
      {
        title: "کار انجام‌شده را ببندید",
        text: "پس از انجام تماس یا وظیفه، آن را تکمیل کنید و اگر ادامه دارد یک اقدام بعدی تازه ثبت کنید تا صف کار تمیز بماند.",
      },
    ],
  },
  {
    id: "visits",
    category: "عملیات روزانه",
    title: "برنامه‌ریزی و اجرای بازدید",
    summary:
      "زمان، مسئول، ملک و متقاضی را هماهنگ و نتیجه بازدید را برای مذاکره بعدی مستند کنید.",
    duration: "۷ دقیقه",
    icon: CalendarDays,
    href: "/visits",
    permission: "visits.manage",
    keywords:
      "بازدید ساعت تاریخ حضور عدم حضور امتیاز علاقه بازخورد مالک متقاضی",
    outcome:
      "سوابق بازدید قابل سنجش و آماده تبدیل به پیشنهاد و مذاکره خواهند بود.",
    warning:
      "بازدید تنها بخشی است که تاریخ و ساعت دقیق هر دو الزامی‌اند. پیش از ثبت، هماهنگی مالک و متقاضی را قطعی کنید.",
    steps: [
      {
        title: "ملک و متقاضی را متصل کنید",
        text: "فایل فعال، متقاضی، نیاز مرتبط و مشاور مسئول را انتخاب کنید تا تمام سابقه در پرونده‌ها باقی بماند.",
      },
      {
        title: "زمان دقیق شمسی ثبت کنید",
        text: "تاریخ و ساعت را مانند ۱۴۰۵/۰۶/۰۵ ۱۷:۳۰ وارد و توضیحات دسترسی، کلید یا محل قرار را اضافه کنید.",
      },
      {
        title: "وضعیت اجرا را به‌روز کنید",
        text: "تأیید، شروع، تکمیل، لغو یا عدم حضور را ثبت کنید. این وضعیت‌ها در ارزیابی عملکرد و گزارش‌ها استفاده می‌شوند.",
      },
      {
        title: "بازخورد و اقدام بعدی را بنویسید",
        text: "میزان علاقه، امتیاز متقاضی، بازخورد مالک و متقاضی و تاریخ پیگیری بعدی را ثبت کنید. برای علاقه جدی، پیشنهاد قیمت بسازید.",
      },
    ],
  },
  {
    id: "offers-deals",
    category: "معامله",
    title: "پیشنهاد، مذاکره و تشکیل معامله",
    summary:
      "دورهای پیشنهاد قیمت و شرایط را مستند کنید و پذیرش نهایی را به معامله قابل مدیریت تبدیل کنید.",
    duration: "۸ دقیقه",
    icon: Handshake,
    href: "/offers",
    permission: "deals.view",
    keywords: "پیشنهاد قیمت مذاکره متقابل پذیرش رد معامله رزرو توافق",
    outcome:
      "توافق شفاهی به یک زنجیره قابل پیگیری از پیشنهاد تا معامله تبدیل می‌شود.",
    warning:
      "قیمت و شرایط هر دور را ویرایش نکنید؛ برای تغییر، پیشنهاد متقابل جدید بسازید تا تاریخچه مذاکره از بین نرود.",
    steps: [
      {
        title: "پیشنهاد اولیه را ثبت کنید",
        text: "ملک، متقاضی و بازدید مرتبط را انتخاب و قیمت فروش یا ودیعه و اجاره، شرایط و تاریخ اعتبار را وارد کنید.",
      },
      {
        title: "پاسخ مالک را ثبت کنید",
        text: "پیشنهاد را پذیرفته، رد یا متقابل علامت بزنید و علت یا توضیح پاسخ را شفاف بنویسید.",
      },
      {
        title: "مذاکره را دوربه‌دور ادامه دهید",
        text: "برای تغییر قیمت یا شرایط دور جدید بسازید. آجر همه دورها را مستقل نگه می‌دارد تا اختلافی در سابقه ایجاد نشود.",
      },
      {
        title: "پذیرش را به معامله تبدیل کنید",
        text: "با پذیرش نهایی، معامله توافق‌شده ساخته و ملک رزرو می‌شود. سپس مسئول معامله مراحل خط لوله را تا قرارداد پیش می‌برد.",
      },
    ],
  },
  {
    id: "legal",
    category: "معامله",
    title: "قرارداد و پرونده حقوقی",
    summary:
      "طرفین، شهود، تعهدات، مدارک و نسخه قرارداد را کنترل کنید تا پرونده آماده امضا و چاپ شود.",
    duration: "۱۲ دقیقه",
    icon: Scale,
    href: "/deals",
    permission: "deals.view",
    keywords: "قرارداد حقوقی کاتب شاهد ضامن امضا تعهد مدرک چاپ A4",
    outcome:
      "پرونده معامله از نظر مدارک، امضاها و تعهدات قابل ردیابی و چاپ خواهد بود.",
    warning:
      "ثبت مرحله قرارداد تنها پس از تکمیل موارد الزامی و امضای طرفین مجاز است. فایل چاپی جایگزین بررسی حقوقی متخصص نیست.",
    steps: [
      {
        title: "پرونده حقوقی معامله را آغاز کنید",
        text: "از جزئیات معامله وارد بخش حقوقی شوید و نوع قرارداد، مشخصات ثبت کاتب و اطلاعات پایه را تکمیل کنید.",
      },
      {
        title: "طرفین، ضامن و شهود را کنترل کنید",
        text: "هویت و نقش هر شخص را مشخص و مدارک موردنیاز را به پرونده پیوست کنید. مغایرت نام و کد ملی را پیش از قرارداد رفع کنید.",
      },
      {
        title: "نسخه و تعهدات را ثبت کنید",
        text: "نسخه‌های پیش‌نویس تا امضا، مبلغ‌ها، سررسیدها، تحویل، تخلیه و سایر تعهدات را شفاف و تاریخ‌دار ثبت کنید.",
      },
      {
        title: "چک‌لیست، امضا و چاپ را نهایی کنید",
        text: "مدارک الزامی، تأیید طرفین و امضاها را تکمیل کنید؛ سپس نسخه A4 را از همان پرونده چاپ و بایگانی کنید.",
      },
    ],
  },
  {
    id: "commission",
    category: "مالی",
    title: "کمیسیون، سهم پرسنل و تسویه",
    summary:
      "تعرفه هر نوع معامله، مالیات، سهم دفتر و سهم اعضای درگیر را محاسبه و وصول کنید.",
    duration: "۹ دقیقه",
    icon: WalletCards,
    href: "/commissions",
    permission: "commissions.view",
    keywords: "کمیسیون پورسانت تعرفه مالیات سهم دفتر بازاریاب مشاور وصول تسویه",
    outcome:
      "مبلغ قابل دریافت و سهم هر شخص شفاف، تأییدشده و قابل تسویه می‌شود.",
    warning:
      "پیش از شروع معامله واقعی، تعرفه‌های دفتر را تنظیم کنید. تغییر تعرفه نباید تاریخچه کمیسیون معاملات نهایی‌شده را مخدوش کند.",
    steps: [
      {
        title: "تعرفه‌های دفتر را تعریف کنید",
        text: "برای فروش، اجاره، رهن و سایر معاملات، مبنای محاسبه، نرخ هر طرف، مبلغ ثابت، مالیات و سقف را مشخص کنید.",
      },
      {
        title: "کمیسیون معامله را کنترل کنید",
        text: "پس از توافق، مبلغ مالک، متقاضی، مالیات و جمع کل را بازبینی و در صورت داشتن مجوز مالی تأیید کنید.",
      },
      {
        title: "سهم پرسنل را تخصیص دهید",
        text: "مشاور فایل، مشاور متقاضی، بازاریاب و سایر همکاران را با درصد یا مبلغ مشخص به کمیسیون متصل کنید.",
      },
      {
        title: "وصول و تسویه را ثبت کنید",
        text: "دریافت از طرفین و پرداخت سهم‌ها را با تاریخ، حساب و مرجع ثبت کنید تا گردش متناظر در حسابداری دفتر نیز ایجاد شود.",
      },
    ],
  },
  {
    id: "accounting",
    category: "مالی",
    title: "حسابداری، چک و حقوق",
    summary:
      "صندوق و بانک، درآمد و هزینه، طلب و بدهی، چک‌ها و حقوق پرسنل را یکپارچه مدیریت کنید.",
    duration: "۱۲ دقیقه",
    icon: Landmark,
    href: "/accounting",
    permission: "accounting.view",
    keywords: "حسابداری صندوق بانک تنخواه درآمد هزینه طلب بدهی چک صیاد حقوق",
    outcome:
      "مانده حساب‌ها، تعهدات سررسیددار و سود و زیان دفتر قابل اتکا می‌شود.",
    warning:
      "برای اصلاح اشتباه، سابقه مالی را بی‌دلیل حذف نکنید؛ گردش اصلاحی با توضیح و مرجع ثبت کنید تا رد حسابرسی باقی بماند.",
    steps: [
      {
        title: "حساب‌ها و دسته‌ها را آماده کنید",
        text: "صندوق، بانک و تنخواه را بسازید و دسته‌های درآمد و هزینه را متناسب با دفتر تعریف کنید.",
      },
      {
        title: "گردش مالی را با مرجع ثبت کنید",
        text: "درآمد، هزینه، انتقال، طلب، بدهی، دریافت یا پرداخت را با تاریخ شمسی، مبلغ، حساب، پرونده مرتبط و شماره مرجع وارد کنید.",
      },
      {
        title: "چک‌ها را تا تعیین تکلیف پیگیری کنید",
        text: "جهت چک، شماره، شناسه صیادی، بانک، صادرکننده و سررسید را ثبت و وضعیت را تا وصول، برگشت یا ابطال به‌روز کنید.",
      },
      {
        title: "حقوق و تعهدات را مدیریت کنید",
        text: "حقوق ماهانه، مزایا، کسورات و مبلغ خالص را محاسبه، تأیید و از حساب درست پرداخت کنید. سررسید طلب‌ها و بدهی‌ها را در داشبورد مالی ببینید.",
      },
    ],
  },
  {
    id: "reports-security",
    category: "مدیریت",
    title: "گزارش‌ها، امنیت و نگهداری سامانه",
    summary:
      "عملکرد دفتر را تحلیل، دسترسی‌ها را بازبینی و اشتراک و امنیت حساب‌ها را کنترل کنید.",
    duration: "۱۰ دقیقه",
    icon: ShieldCheck,
    href: "/reports",
    permission: "reports.view",
    keywords: "گزارش امنیت رمز نشست قفل اشتراک پرداخت تمدید عملکرد قیف فروش",
    outcome:
      "مدیر دفتر بر فروش، بهره‌وری، دسترسی کاربران و تداوم سرویس کنترل خواهد داشت.",
    warning:
      "گزارش خوب نتیجه داده درست است. ثبت دیرهنگام یا ناقص تماس، بازدید، معامله و وصول باعث شاخص‌های گمراه‌کننده می‌شود.",
    steps: [
      {
        title: "گزارش مدیریتی را دوره‌ای ببینید",
        text: "قیف فروش، نرخ تبدیل، عملکرد پرسنل، منابع جذب، مناطق پربازده، فایل‌های راکد، مطالبات و سود و زیان را در بازه مناسب بررسی کنید.",
      },
      {
        title: "دسترسی‌ها را بازبینی کنید",
        text: "با تغییر نقش یا خروج پرسنل، دسترسی‌ها را اصلاح یا حساب را غیرفعال کنید. غیرفعال‌سازی نشست‌های فعال او را می‌بندد.",
      },
      {
        title: "پروفایل و رمز را امن نگه دارید",
        text: "تصویر و مشخصات را در پروفایل ویرایش و از رمز قوی و اختصاصی استفاده کنید. پس از ورودهای ناموفق مکرر، حساب موقتاً قفل می‌شود.",
      },
      {
        title: "اشتراک را پیش از پایان تمدید کنید",
        text: "پلن و AI را انتخاب و درخواست تماس یا مشخصات واریز و فیش را ثبت کنید. پس از تأیید مدیریت کل، مدت دسترسی فعال می‌شود.",
      },
    ],
  },
];

const categories = [
  "همه",
  "شروع کار",
  "اطلاعات پایه",
  "بازاریابی",
  "عملیات روزانه",
  "معامله",
  "مالی",
  "مدیریت",
];

const faqs = [
  [
    "چرا یک فایل یا مخاطب را نمی‌بینم؟",
    "ابتدا مطمئن شوید در همان دفتر وارد شده‌اید و دسترسی بخش مربوط را دارید. کاربران فقط اطلاعات دفتر خود را می‌بینند و بعضی نقش‌ها فقط پرونده‌های واگذارشده به خودشان را مدیریت می‌کنند.",
  ],
  [
    "تاریخ‌ها را با چه الگویی وارد کنم؟",
    "تمام تاریخ‌ها شمسی هستند؛ مانند ۱۴۰۵/۰۶/۰۵. در بازدید، ساعت نیز الزامی است و باید مانند ۱۴۰۵/۰۶/۰۵ ۱۷:۳۰ وارد شود. ارقام فارسی و انگلیسی پذیرفته می‌شوند.",
  ],
  [
    "چرا هوش مصنوعی نتیجه‌ای پیدا نکرد؟",
    "متن را ساده‌تر کنید، بودجه و محله را کنترل کنید و مطمئن شوید فایل‌های منطبق فعال و اطلاعات قیمت و موقعیت آن‌ها کامل است. AI روی اطلاعات واقعی دفتر جست‌وجو می‌کند و فایل جدیدی اختراع نمی‌کند.",
  ],
  [
    "آیا مدارک و فیش‌ها عمومی هستند؟",
    "خیر. فایل‌های خصوصی فقط از مسیرهای احراز هویت‌شده و برای افراد مجاز همان دفتر یا مدیریت کل قابل دریافت‌اند و لینک عمومی مستقیم ندارند.",
  ],
  [
    "چرا نمی‌توانم معامله را تکمیل کنم؟",
    "تکمیل معامله به وضعیت قرارداد، تأیید پرونده حقوقی، کمیسیون و ثبت وصول‌های الزامی وابسته است. پیام بالای صفحه معامله دقیقاً مرحله ناقص را مشخص می‌کند.",
  ],
  [
    "در صورت فراموشی رمز چه کنم؟",
    "در صفحه ورود، بازیابی رمز را انتخاب کنید. کد یک‌بارمصرف به شماره همراه ثبت‌شده ارسال می‌شود و پس از تأیید می‌توانید رمز تازه تعیین کنید.",
  ],
] as const;

export function HelpCenter({ permissions }: { permissions: string[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("همه");
  const normalized = query.trim().toLocaleLowerCase("fa-IR");
  const filtered = useMemo(
    () =>
      guides.filter((guide) => {
        const categoryMatches =
          category === "همه" || guide.category === category;
        const text =
          `${guide.title} ${guide.summary} ${guide.keywords} ${guide.steps.map((step) => `${step.title} ${step.text}`).join(" ")}`.toLocaleLowerCase(
            "fa-IR",
          );
        return categoryMatches && (!normalized || text.includes(normalized));
      }),
    [category, normalized],
  );
  const startSteps = [
    ["تنظیم دفتر", "مرکز نقشه و پیشوند فایل", "/settings", "settings.manage"],
    ["ساخت کاربران", "نقش و دسترسی هر فرد", "/users", "users.manage"],
    ["ثبت مالک", "هویت و راه ارتباطی", "/owners", "contacts.manage"],
    [
      "ثبت فایل",
      "مشخصات، نقشه و تصاویر",
      "/properties/new",
      "properties.create",
    ],
    ["ثبت متقاضی", "نیاز، بودجه و محله", "/applicants", "contacts.manage"],
    ["تطبیق و بازدید", "معرفی گزینه و پیگیری", "/matching", "ai.use"],
  ].filter(([, , , permission]) => permissions.includes(permission));

  return (
    <div className="help-center">
      <section className="help-hero">
        <div className="help-hero-copy">
          <span className="help-hero-badge">
            <CircleHelp size={16} /> مرکز آموزش آجر
          </span>
          <h1>
            از اولین فایل تا قرارداد؛ <span>قدم‌به‌قدم کنار شما</span>
          </h1>
          <p>
            راهنمای عملی مدیریت دفتر املاک، مطابق مسیرهای واقعی سامانه. موضوع را
            جست‌وجو کنید یا از مسیر پیشنهادی شروع شوید.
          </p>
          <label className="help-search">
            <Search size={20} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="مثلاً: ثبت فایل، بازدید، کمیسیون یا قرارداد…"
              aria-label="جست‌وجو در راهنما"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="پاک‌کردن جست‌وجو"
              >
                <X size={17} />
              </button>
            )}
          </label>
          <div className="help-popular">
            <span>پرجست‌وجو:</span>
            {["ثبت فایل", "بازدید", "کمیسیون", "تاریخ شمسی"].map((item) => (
              <button type="button" key={item} onClick={() => setQuery(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="help-hero-visual" aria-label="مسیر کاری آجر">
          <div className="help-visual-window">
            <div className="help-visual-top">
              <span />
              <span />
              <span />
              <b>مسیر یک معامله موفق</b>
            </div>
            <div className="help-visual-flow">
              {[
                [Users, "مالک"],
                [Building2, "فایل"],
                [UserRoundSearch, "متقاضی"],
                [CalendarDays, "بازدید"],
                [Handshake, "معامله"],
                [FileCheck2, "قرارداد"],
              ].map(([Icon, title], index) => {
                const FlowIcon = Icon as LucideIcon;
                return (
                  <div key={title as string}>
                    <span>
                      <FlowIcon size={18} />
                    </span>
                    <b>{title as string}</b>
                    {index < 5 && <ArrowLeft size={14} />}
                  </div>
                );
              })}
            </div>
            <div className="help-visual-success">
              <Check size={18} />
              <span>
                <b>اطلاعات یکپارچه</b>
                <small>همه مراحل در یک پرونده قابل پیگیری است</small>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="help-start" id="quick-start">
        <div className="help-section-title">
          <span>
            <PlayCircle size={18} /> شروع سریع
          </span>
          <h2>مسیر پیشنهادی برای اولین روز کاری</h2>
          <p>اگر تازه وارد آجر شده‌اید، این شش گام را به‌ترتیب انجام دهید.</p>
        </div>
        <div className="help-start-steps">
          {startSteps.map(([title, text, href], index) => (
            <Link href={href} key={href} className="help-start-step">
              <span>{(index + 1).toLocaleString("fa-IR")}</span>
              <b>{title}</b>
              <small>{text}</small>
              <ArrowUpLeft size={16} />
            </Link>
          ))}
        </div>
      </section>

      <section className="help-tutorials" id="tutorials">
        <div className="help-section-title">
          <span>
            <ListChecks size={18} /> آموزش‌های جامع
          </span>
          <h2>هر کاری را دقیق و مرحله‌به‌مرحله انجام دهید</h2>
          <p>
            کارت هر موضوع را باز کنید تا مراحل، نتیجه و نکات مهم آن را ببینید.
          </p>
        </div>
        <div
          className="help-categories"
          role="group"
          aria-label="دسته‌بندی آموزش‌ها"
        >
          {categories.map((item) => (
            <button
              type="button"
              className={category === item ? "active" : ""}
              onClick={() => setCategory(item)}
              key={item}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="help-results-meta">
          <b>{filtered.length.toLocaleString("fa-IR")} آموزش</b>
          {normalized && <span>برای «{query}»</span>}
        </div>
        <div className="help-guide-list">
          {filtered.map((guide, index) => {
            const Icon = guide.icon;
            return (
              <details
                className="help-guide-card"
                key={guide.id}
                id={guide.id}
                open={Boolean(normalized)}
              >
                <summary>
                  <span className="help-guide-number">
                    {(index + 1).toLocaleString("fa-IR")}
                  </span>
                  <span className="help-guide-icon">
                    <Icon size={23} />
                  </span>
                  <span className="help-guide-title">
                    <span>
                      {guide.category} · {guide.duration}
                    </span>
                    <b>{guide.title}</b>
                    <small>{guide.summary}</small>
                  </span>
                  <span className="help-guide-toggle">
                    <ChevronDown size={20} />
                  </span>
                </summary>
                <div className="help-guide-content">
                  <div className="help-guide-steps">
                    {guide.steps.map((step, stepIndex) => (
                      <div className="help-guide-step" key={step.title}>
                        <span>{(stepIndex + 1).toLocaleString("fa-IR")}</span>
                        <div>
                          <b>{step.title}</b>
                          <p>{step.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <aside className="help-guide-aside">
                    <div className="help-outcome">
                      <Check size={18} />
                      <span>
                        <b>نتیجه این آموزش</b>
                        <p>{guide.outcome}</p>
                      </span>
                    </div>
                    {guide.warning && (
                      <div className="help-warning">
                        <Lightbulb size={18} />
                        <span>
                          <b>نکته مهم</b>
                          <p>{guide.warning}</p>
                        </span>
                      </div>
                    )}
                    {permissions.includes(guide.permission) ? (
                      <Link className="btn btn-dark" href={guide.href}>
                        ورود به این بخش <ArrowLeft size={16} />
                      </Link>
                    ) : (
                      <span className="help-no-access">
                        <ShieldCheck size={16} /> این بخش برای نقش شما فعال نیست
                      </span>
                    )}
                  </aside>
                </div>
              </details>
            );
          })}
          {!filtered.length && (
            <div className="help-no-result">
              <Search size={28} />
              <b>آموزشی پیدا نشد</b>
              <p>عبارت کوتاه‌تری بنویسید یا دسته «همه» را انتخاب کنید.</p>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setQuery("");
                  setCategory("همه");
                }}
              >
                نمایش همه آموزش‌ها
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="help-checklist">
        <div>
          <span className="help-hero-badge">
            <ClipboardCheck size={16} /> چک‌لیست عملیاتی
          </span>
          <h2>قبل از تحویل کلید و بستن پرونده</h2>
          <p>این کنترل نهایی، خطاهای متداول معامله را کم می‌کند.</p>
        </div>
        <div className="help-checklist-items">
          {[
            "هویت و مدارک طرفین تأیید شده",
            "قیمت و شرایط نهایی ثبت شده",
            "قرارداد و امضاها کامل است",
            "تعهدها و چک‌ها سررسید دارند",
            "کمیسیون و مالیات تأیید شده",
            "وصول، تسویه و تحویل ثبت شده",
          ].map((item) => (
            <span key={item}>
              <Check size={16} />
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="help-faq">
        <div className="help-section-title">
          <span>
            <CircleHelp size={18} /> پرسش‌های متداول
          </span>
          <h2>پاسخ سریع به سؤال‌های رایج</h2>
        </div>
        <div className="help-faq-grid">
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <ChevronDown size={18} />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="golden-rule help-golden-rule">
        <div className="golden-rule-mark">آ</div>
        <div>
          <h2 className="font-black text-xl">قاعده طلایی آجر</h2>
          <p className="mt-2">
            اطلاعات را همان لحظه، دقیق و به پرونده درست متصل ثبت کنید؛ کیفیت
            گزارش، تطبیق هوشمند و تصمیم مدیر دقیقاً به کیفیت داده‌های تیم وابسته
            است.
          </p>
        </div>
        <Link href="/dashboard" className="btn dashboard-ghost-action">
          بازگشت به میز کار <ArrowLeft size={16} />
        </Link>
      </section>
    </div>
  );
}
