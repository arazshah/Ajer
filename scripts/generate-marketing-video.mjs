import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const work = join(root, ".tmp", "marketing-video");
const outputDir = join(root, "public", "marketing");
mkdirSync(work, { recursive: true });
mkdirSync(outputDir, { recursive: true });

const colors = {
  ink: "#172033",
  ink2: "#0d1423",
  brick: "#c65d35",
  coral: "#ef916a",
  cream: "#fbfaf7",
  muted: "#6b7689",
  green: "#26a477",
  blue: "#4b7bec",
  white: "#ffffff",
};

const imageData = [1, 2, 3].map((number) => {
  const data = readFileSync(join(root, "public", `property-${number}.png`));
  return `data:image/png;base64,${data.toString("base64")}`;
});

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function text(x, y, value, size = 34, options = {}) {
  const {
    fill = colors.ink,
    weight = 700,
    anchor = "end",
    opacity = 1,
    letterSpacing = 0,
  } = options;
  const svgAnchor =
    anchor === "end" ? "start" : anchor === "start" ? "end" : "middle";
  return `<text x="${x}" y="${y}" text-anchor="${svgAnchor}" direction="rtl" unicode-bidi="plaintext" fill="${fill}" fill-opacity="${opacity}" font-family="Vazirmatn, Noto Sans Arabic, sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="${letterSpacing}">${esc(value)}</text>`;
}

function rounded(
  x,
  y,
  width,
  height,
  radius,
  fill,
  stroke = "none",
  opacity = 1,
) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}"/>`;
}

function pill(x, y, width, value, fill = "#fff0e8", color = "#a74423") {
  return `${rounded(x, y, width, 54, 27, fill)}${text(x + width - 24, y + 36, value, 23, { fill: color, weight: 850 })}`;
}

function check(x, y, color = colors.green) {
  return `<circle cx="${x}" cy="${y}" r="18" fill="${color}" fill-opacity=".14"/><path d="M${x - 8} ${y}l6 7 12-15" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function screen(x, y, width, height, body) {
  return `<g filter="url(#shadow)">
    ${rounded(x, y, width, height, 30, colors.white, "#dfe3e8")}
    ${rounded(x, y, width, 72, 30, "#f4f5f7")}
    <rect x="${x}" y="${y + 42}" width="${width}" height="30" fill="#f4f5f7"/>
    <circle cx="${x + 36}" cy="${y + 36}" r="8" fill="#ef916a"/>
    <circle cx="${x + 62}" cy="${y + 36}" r="8" fill="#e5c769"/>
    <circle cx="${x + 88}" cy="${y + 36}" r="8" fill="#72c79f"/>
    ${text(x + width - 30, y + 45, "داشبورد آجر", 22, { fill: colors.muted, weight: 800 })}
    ${body}
  </g>`;
}

function progress(index) {
  const dots = Array.from({ length: 9 }, (_, item) => {
    const active = item <= index;
    return `<rect x="${682 + item * 66}" y="1010" width="48" height="8" rx="4" fill="${active ? colors.brick : "#d8dce2"}"/>`;
  }).join("");
  return `<g>${dots}</g>`;
}

function base(index, eyebrow, title, subtitle, content, dark = false) {
  const background = dark ? colors.ink2 : colors.cream;
  const titleColor = dark ? colors.white : colors.ink;
  const subtitleColor = dark ? "#ffffffa6" : colors.muted;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
    <defs>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="22" stdDeviation="24" flood-color="#101728" flood-opacity=".16"/></filter>
      <linearGradient id="brand" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#e9835c"/><stop offset="1" stop-color="#aa3f22"/></linearGradient>
      <radialGradient id="glow"><stop stop-color="#ef916a" stop-opacity=".28"/><stop offset="1" stop-color="#ef916a" stop-opacity="0"/></radialGradient>
      <clipPath id="propertyClip"><rect x="160" y="342" width="620" height="505" rx="26"/></clipPath>
    </defs>
    <rect width="1920" height="1080" fill="${background}"/>
    <circle cx="130" cy="120" r="360" fill="url(#glow)"/>
    <circle cx="1810" cy="920" r="280" fill="url(#glow)" opacity=".45"/>
    ${pill(1560, 68, 210, eyebrow, dark ? "#ffffff12" : "#fff0e8", dark ? "#ffad89" : "#a74423")}
    ${text(1770, 192, title, 68, { fill: titleColor, weight: 950 })}
    ${text(1770, 252, subtitle, 29, { fill: subtitleColor, weight: 550 })}
    ${content}
    ${progress(index)}
    ${text(1780, 1030, "آجر · مرکز کنترل دفتر املاک", 22, { fill: dark ? "#ffffff65" : "#818a99", weight: 700 })}
  </svg>`;
}

const scenes = [
  base(
    0,
    "دموی ۹۰ ثانیه‌ای",
    "آجر؛ مرکز کنترل دفتر املاک",
    "از اولین فایل تا آخرین ریال کمیسیون، همه‌چیز در یک جریان کاری روشن",
    `<g transform="translate(0 20)">
      <circle cx="960" cy="570" r="205" fill="url(#brand)" filter="url(#shadow)"/>
      ${text(960, 645, "آ", 250, { fill: colors.white, weight: 950, anchor: "middle" })}
      ${pill(260, 545, 285, "فایل و مالک", "#ffffff14", "#ffffff")}
      ${pill(1375, 545, 285, "متقاضی و پیگیری", "#ffffff14", "#ffffff")}
      <path d="M550 572h170M1200 572h170" stroke="#ef916a" stroke-width="5" stroke-linecap="round" stroke-dasharray="10 14"/>
      ${text(960, 840, "مالک + مستأجر = آجر", 38, { fill: "#ffffffc9", weight: 800, anchor: "middle" })}
    </g>`,
    true,
  ),
  base(
    1,
    "یک دفتر، یک سیستم",
    "همه اطلاعات دفتر، در یک جای امن",
    "دفتر کاغذی، اکسل و پیام‌های پراکنده را به یک پایگاه منظم تبدیل کنید",
    `<g>
      ${rounded(145, 365, 390, 190, 24, "#ffffff", "#e1e4e9")}
      ${text(490, 420, "دفتر کاغذی", 28, { weight: 900 })}
      ${text(490, 472, "فایل‌ها و شماره‌های پراکنده", 22, { fill: colors.muted, weight: 500 })}
      ${rounded(145, 595, 390, 190, 24, "#ffffff", "#e1e4e9")}
      ${text(490, 650, "پیام‌رسان و اکسل", 28, { weight: 900 })}
      ${text(490, 702, "پیگیری‌های فراموش‌شده", 22, { fill: colors.muted, weight: 500 })}
      <path d="M590 570h190" stroke="${colors.brick}" stroke-width="6" stroke-linecap="round"/>
      <path d="M750 548l30 22-30 22" fill="none" stroke="${colors.brick}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      ${screen(
        820,
        330,
        940,
        500,
        `
        ${rounded(850, 430, 250, 130, 18, "#fff2ec")}${text(1070, 475, "فایل‌های فعال", 21, { fill: colors.muted })}${text(1070, 530, "۱۴۸", 43, { fill: colors.brick, weight: 950 })}
        ${rounded(1130, 430, 250, 130, 18, "#eef5ff")}${text(1350, 475, "پیگیری امروز", 21, { fill: colors.muted })}${text(1350, 530, "۲۱", 43, { fill: colors.blue, weight: 950 })}
        ${rounded(1410, 430, 310, 130, 18, "#ebf8f2")}${text(1690, 475, "بازدید این هفته", 21, { fill: colors.muted })}${text(1690, 530, "۱۲", 43, { fill: colors.green, weight: 950 })}
        ${rounded(850, 595, 870, 180, 20, colors.ink)}${text(1680, 642, "نبض امروز دفتر", 25, { fill: colors.white, weight: 900 })}
        ${check(910, 695)}${text(950, 703, "تمام داده‌ها متعلق به همین دفتر", 23, { fill: "#ffffffc9", weight: 600, anchor: "start" })}
      `,
      )}
    </g>`,
  ),
  base(
    2,
    "گام اول",
    "ثبت کامل فایل؛ سریع و نقشه‌محور",
    "مالک، مشخصات، قیمت، تصاویر و موقعیت دقیق ملک را یک‌بار و درست ثبت کنید",
    `<g filter="url(#shadow)">
      ${rounded(120, 320, 1680, 570, 32, colors.white, "#e2e5e9")}
      <image href="${imageData[0]}" x="160" y="342" width="620" height="505" preserveAspectRatio="xMidYMid slice" clip-path="url(#propertyClip)"/>
      ${pill(190, 375, 180, "فایل فعال", "#e9f8f1", "#087654")}
      ${text(1720, 390, "آپارتمان ۱۲۰ متری دوخواب", 38, { weight: 950 })}
      ${text(1720, 438, "فروش · ارومیه · خیابان حسنی", 23, { fill: colors.muted, weight: 550 })}
      ${rounded(850, 485, 250, 115, 18, "#f7f8fa")}${text(1065, 528, "متراژ", 19, { fill: colors.muted })}${text(1065, 575, "۱۲۰ متر", 29, { weight: 900 })}
      ${rounded(1130, 485, 250, 115, 18, "#f7f8fa")}${text(1345, 528, "اتاق", 19, { fill: colors.muted })}${text(1345, 575, "۲ خواب", 29, { weight: 900 })}
      ${rounded(1410, 485, 310, 115, 18, "#fff2ec")}${text(1685, 528, "قیمت کل", 19, { fill: colors.muted })}${text(1685, 575, "۶ میلیارد", 29, { fill: colors.brick, weight: 900 })}
      ${rounded(850, 640, 870, 180, 22, "#edf3ef")}
      <path d="M890 785c110-120 210 40 330-60s260 15 460-35" fill="none" stroke="#9eb5a8" stroke-width="15" stroke-linecap="round" opacity=".65"/>
      <circle cx="1375" cy="704" r="20" fill="${colors.brick}" stroke="white" stroke-width="7"/>
      ${text(1680, 685, "موقعیت روی نقشه", 22, { fill: colors.muted, weight: 800 })}
    </g>`,
  ),
  base(
    3,
    "گام دوم",
    "متقاضی را دقیق بشناسید",
    "بودجه، محله، متراژ و اولویت‌ها را ثبت کنید تا پیشنهادها دقیق‌تر شوند",
    `${screen(
      170,
      330,
      1580,
      540,
      `
      ${rounded(220, 430, 1480, 90, 18, "#f7f8fa")}${text(1660, 485, "متقاضی: نیما احمدی · خرید آپارتمان", 28, { weight: 900 })}
      ${rounded(220, 555, 340, 135, 20, "#fff3ed")}${text(520, 600, "بودجه", 20, { fill: colors.muted })}${text(520, 654, "تا ۶ میلیارد", 30, { fill: colors.brick, weight: 950 })}
      ${rounded(590, 555, 340, 135, 20, "#eef5ff")}${text(890, 600, "متراژ", 20, { fill: colors.muted })}${text(890, 654, "۹۰ تا ۱۳۰ متر", 30, { fill: colors.blue, weight: 950 })}
      ${rounded(960, 555, 340, 135, 20, "#ebf8f2")}${text(1260, 600, "اولویت", 20, { fill: colors.muted })}${text(1260, 654, "فوری", 30, { fill: colors.green, weight: 950 })}
      ${rounded(1330, 555, 370, 135, 20, "#f4f1fb")}${text(1660, 600, "محله‌ها", 20, { fill: colors.muted })}${text(1660, 654, "حسنی · استادان", 30, { fill: "#7658b1", weight: 950 })}
      ${pill(230, 735, 180, "پارکینگ", "#f0f2f5", colors.ink)}${pill(430, 735, 180, "آسانسور", "#f0f2f5", colors.ink)}${pill(630, 735, 190, "دو خواب", "#f0f2f5", colors.ink)}
      ${check(1635, 762)}${text(1590, 770, "شرایط آماده تطبیق است", 24, { fill: colors.green, weight: 850 })}
    `,
    )}`,
  ),
  base(
    4,
    "گام سوم",
    "تطبیق هوشمند، در چند ثانیه",
    "شرایط را طبیعی بنویسید؛ آجر مناسب‌ترین فایل‌های همان دفتر را پیدا می‌کند",
    `<g>
      ${rounded(170, 330, 1580, 100, 28, colors.ink, "none")}
      ${text(1685, 392, "«آپارتمان دوخواب تا ۶ میلیارد، پارکینگ‌دار در حسنی»", 31, { fill: colors.white, weight: 650 })}
      ${pill(190, 353, 155, "جست‌وجو", colors.brick, colors.white)}
      ${[0, 1, 2]
        .map((item) => {
          const x = 170 + item * 535;
          const score = [96, 89, 82][item];
          return `<g filter="url(#shadow)">${rounded(x, 475, 480, 370, 24, colors.white, "#e2e5e9")}
          <image href="${imageData[item]}" x="${x + 18}" y="493" width="444" height="175" preserveAspectRatio="xMidYMid slice" clip-path="inset(0 round 16px)"/>
          ${pill(x + 28, 507, 130, `${score}٪ تطبیق`, "#e8f7f0", "#087654")}
          ${text(x + 440, 720, ["آپارتمان حسنی", "واحد استادان", "آپارتمان امین"][item], 27, { weight: 900 })}
          ${text(x + 440, 766, ["۱۲۰ متر · ۲ خواب", "۱۰۸ متر · ۲ خواب", "۱۲۵ متر · ۳ خواب"][item], 20, { fill: colors.muted, weight: 550 })}
          ${text(x + 440, 813, ["۶ میلیارد", "۵٫۸ میلیارد", "۶٫۲ میلیارد"][item], 24, { fill: colors.brick, weight: 900 })}
        </g>`;
        })
        .join("")}
    </g>`,
  ),
  base(
    5,
    "گام چهارم",
    "پیگیری و بازدید؛ هیچ قرار فراموش نمی‌شود",
    "تماس‌ها، یادآوری‌ها و بازدیدهای شمسی در تقویم مشترک تیم ثبت می‌شوند",
    `${screen(
      160,
      330,
      1600,
      550,
      `
      ${rounded(210, 420, 470, 400, 22, "#f7f8fa")}
      ${text(640, 466, "شهریور ۱۴۰۵", 27, { weight: 900 })}
      ${[0, 1, 2, 3, 4, 5, 6].map((i) => text(250 + i * 59, 520, ["ش", "ی", "د", "س", "چ", "پ", "ج"][i], 18, { fill: colors.muted, anchor: "middle" })).join("")}
      ${Array.from({ length: 28 }, (_, i) => {
        const cx = 250 + (i % 7) * 59;
        const cy = 570 + Math.floor(i / 7) * 64;
        const active = i === 17;
        return `${active ? `<circle cx="${cx}" cy="${cy - 8}" r="23" fill="${colors.brick}"/>` : ""}${text(cx, cy, String(i + 1), 19, { fill: active ? colors.white : colors.ink, anchor: "middle", weight: active ? 900 : 600 })}`;
      }).join("")}
      ${rounded(735, 420, 970, 105, 20, "#fff3ed")}${text(1660, 462, "۱۰:۳۰ · بازدید آپارتمان حسنی", 27, { fill: colors.brick, weight: 900 })}${text(1660, 498, "با نیما احمدی · مسئول: سارا محمدی", 19, { fill: colors.muted, weight: 550 })}
      ${rounded(735, 555, 970, 105, 20, "#eef5ff")}${text(1660, 597, "۱۲:۰۰ · تماس پیگیری مالک", 27, { fill: colors.blue, weight: 900 })}${text(1660, 633, "یادآوری خودکار برای کارشناس فایل", 19, { fill: colors.muted, weight: 550 })}
      ${rounded(735, 690, 970, 105, 20, "#ebf8f2")}${text(1660, 732, "۱۷:۳۰ · جلسه توافق اولیه", 27, { fill: colors.green, weight: 900 })}${text(1660, 768, "تمام سوابق داخل پرونده مشتری", 19, { fill: colors.muted, weight: 550 })}
    `,
    )}`,
  ),
  base(
    6,
    "گام پنجم",
    "از توافق تا قرارداد، یک مسیر شفاف",
    "پیشنهاد، مدارک، قرارداد و دریافت‌ها را مرحله‌به‌مرحله کنترل کنید",
    `<g filter="url(#shadow)">
      ${rounded(150, 350, 1620, 480, 30, colors.white, "#e2e5e9")}
      ${["مذاکره", "توافق", "قرارداد", "تکمیل"]
        .map((label, item) => {
          const x = 315 + item * 420;
          return `<circle cx="${x}" cy="505" r="46" fill="${item < 3 ? colors.brick : "#e9ecf0"}"/>
          ${item < 3 ? check(x, 505, colors.white) : text(x, 516, "۴", 25, { fill: colors.muted, anchor: "middle", weight: 900 })}
          ${text(x, 590, label, 27, { fill: item < 3 ? colors.ink : colors.muted, anchor: "middle", weight: 900 })}
          ${item < 3 ? `<path d="M${x + 56} 505h308" stroke="${colors.brick}" stroke-width="7" stroke-linecap="round"/>` : ""}`;
        })
        .join("")}
      ${rounded(240, 665, 1440, 105, 20, "#f7f8fa")}
      ${check(1635, 718)}${text(1595, 726, "مدارک طرفین تأیید شد", 22, { weight: 750 })}
      ${check(1130, 718)}${text(1090, 726, "نسخه قرارداد آماده است", 22, { weight: 750 })}
      ${check(600, 718)}${text(560, 726, "دریافت اولیه ثبت شد", 22, { weight: 750 })}
    </g>`,
  ),
  base(
    7,
    "گام ششم",
    "کمیسیون‌ها؛ دقیق، شفاف و قابل تسویه",
    "سهم دفتر، مشاور، بازاریاب و سایر همکاران بدون اختلاف محاسبه می‌شود",
    `${screen(
      170,
      330,
      1580,
      550,
      `
      ${rounded(220, 420, 500, 380, 24, colors.ink)}
      ${text(670, 475, "کمیسیون این معامله", 23, { fill: "#ffffff9c", weight: 700 })}
      ${text(670, 555, "۱۸۰٬۰۰۰٬۰۰۰", 48, { fill: colors.white, weight: 950 })}
      ${text(670, 595, "تومان", 21, { fill: "#ffffff80", weight: 600 })}
      <circle cx="470" cy="700" r="70" fill="none" stroke="#ffffff1b" stroke-width="22"/>
      <path d="M470 630a70 70 0 1 1-65 96" fill="none" stroke="${colors.coral}" stroke-width="22" stroke-linecap="round"/>
      ${text(470, 711, "ثبت شد", 20, { fill: colors.white, anchor: "middle", weight: 850 })}
      ${[
        ["سهم دفتر", "۹۰ میلیون", 0.82, colors.brick],
        ["مشاور معامله", "۵۴ میلیون", 0.62, colors.blue],
        ["بازاریاب", "۲۷ میلیون", 0.42, colors.green],
        ["کارشناس قرارداد", "۹ میلیون", 0.24, "#8065b8"],
      ]
        .map((row, item) => {
          const y = 445 + item * 90;
          return `${text(1670, y, row[0], 23, { weight: 850 })}${text(1040, y, row[1], 22, { fill: colors.muted, weight: 700 })}${rounded(840, y + 18, 830, 14, 7, "#e9ecf0")}${rounded(840, y + 18, 830 * row[2], 14, 7, row[3])}`;
        })
        .join("")}
    `,
    )}`,
  ),
  base(
    8,
    "نتیجه",
    "مدیر همیشه نبض دفتر را می‌بیند",
    "فایل، مشتری، تیم، معامله و درآمد؛ خصوصی، یکپارچه و همیشه در دسترس",
    `<g>
      ${screen(
        150,
        330,
        1040,
        500,
        `
        ${rounded(190, 430, 290, 120, 18, "#fff2ec")}${text(445, 475, "فایل فعال", 20, { fill: colors.muted })}${text(445, 525, "۱۴۸", 38, { fill: colors.brick, weight: 950 })}
        ${rounded(505, 430, 290, 120, 18, "#eef5ff")}${text(760, 475, "معامله ماه", 20, { fill: colors.muted })}${text(760, 525, "۱۸", 38, { fill: colors.blue, weight: 950 })}
        ${rounded(820, 430, 330, 120, 18, "#ebf8f2")}${text(1110, 475, "پیگیری به‌موقع", 20, { fill: colors.muted })}${text(1110, 525, "۹۴٪", 38, { fill: colors.green, weight: 950 })}
        ${rounded(190, 590, 960, 180, 20, "#f5f6f8")}
        <path d="M240 730c100-20 120-95 220-58s145-68 260-18 165-80 380-18" fill="none" stroke="${colors.brick}" stroke-width="9" stroke-linecap="round"/>
        ${text(1110, 635, "رشد فعالیت دفتر", 20, { fill: colors.muted, weight: 800 })}
      `,
      )}
      <g filter="url(#shadow)">
        ${rounded(1240, 330, 530, 500, 30, "url(#brand)")}
        ${text(1730, 420, "آجر", 82, { fill: colors.white, weight: 950 })}
        ${text(1730, 475, "مرکز کنترل دفتر املاک", 26, { fill: "#ffffffc0", weight: 650 })}
        ${check(1295, 555, colors.white)}${text(1335, 563, "۳۰ روز آزمایشی", 24, { fill: colors.white, anchor: "start", weight: 750 })}
        ${check(1295, 615, colors.white)}${text(1335, 623, "کاربران نامحدود", 24, { fill: colors.white, anchor: "start", weight: 750 })}
        ${check(1295, 675, colors.white)}${text(1335, 683, "اطلاعات کاملاً خصوصی", 24, { fill: colors.white, anchor: "start", weight: 750 })}
        ${rounded(1285, 735, 440, 64, 18, colors.white)}${text(1690, 778, "درخواست دموی ۲۰ دقیقه‌ای", 24, { fill: colors.brick, weight: 900 })}
      </g>
    </g>`,
    false,
  ),
];

for (let index = 0; index < scenes.length; index += 1) {
  const svgPath = join(work, `scene-${index + 1}.svg`);
  const pngPath = join(work, `scene-${index + 1}.png`);
  writeFileSync(svgPath, scenes[index]);
  execFileSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-i", svgPath, "-frames:v", "1", pngPath],
    { stdio: "inherit" },
  );
}

function createMusic() {
  const sampleRate = 44100;
  const duration = 90;
  const channels = 2;
  const frames = sampleRate * duration;
  const pcm = Buffer.alloc(frames * channels * 2);
  const bpm = 104;
  const beat = 60 / bpm;
  const chords = [
    [146.83, 174.61, 220.0],
    [116.54, 146.83, 174.61],
    [174.61, 220.0, 261.63],
    [130.81, 164.81, 196.0],
  ];
  let noiseState = 271828;
  const noise = () => {
    noiseState = (noiseState * 1664525 + 1013904223) >>> 0;
    return noiseState / 2147483648 - 1;
  };
  let smoothNoise = 0;

  for (let frame = 0; frame < frames; frame += 1) {
    const t = frame / sampleRate;
    const beatIndex = Math.floor(t / beat);
    const beatPhase = (t % beat) / beat;
    const halfPhase = (t % (beat / 2)) / (beat / 2);
    const chord = chords[Math.floor(beatIndex / 4) % chords.length];
    const arp =
      chord[(beatIndex * 2 + (halfPhase > 0.5 ? 1 : 0)) % chord.length] * 2;
    const pad = chord.reduce(
      (sum, frequency, index) =>
        sum + Math.sin(2 * Math.PI * frequency * t + index * 0.7) * 0.038,
      0,
    );
    const bassEnvelope = Math.exp(-beatPhase * 3.3);
    const bass =
      Math.sin(2 * Math.PI * (chord[0] / 2) * t) * bassEnvelope * 0.12;
    const pluckEnvelope = Math.exp(-halfPhase * 9);
    const pluck =
      (Math.sin(2 * Math.PI * arp * t) +
        Math.sin(2 * Math.PI * arp * 2 * t) * 0.22) *
      pluckEnvelope *
      0.065;
    const kick =
      Math.sin(2 * Math.PI * (52 + 70 * Math.exp(-beatPhase * 18)) * t) *
      Math.exp(-beatPhase * 18) *
      0.28;
    const snareBeat = beatIndex % 4 === 1 || beatIndex % 4 === 3;
    smoothNoise = smoothNoise * 0.28 + noise() * 0.72;
    const snare = snareBeat
      ? smoothNoise * Math.exp(-beatPhase * 22) * 0.13
      : 0;
    const hat = noise() * Math.exp(-halfPhase * 42) * 0.035;
    const rise = Math.min(1, t / 2.5);
    const fade = Math.min(1, (duration - t) / 5);
    const sectionLift = t > 39 && t < 80 ? 1.12 : 0.92;
    const sample =
      (pad + bass + pluck + kick + snare + hat) * rise * fade * sectionLift;
    const pan = Math.sin(t * 0.23) * 0.08;
    const left = Math.max(-1, Math.min(1, sample * (1 - pan)));
    const right = Math.max(-1, Math.min(1, sample * (1 + pan)));
    pcm.writeInt16LE(Math.round(left * 32767), frame * 4);
    pcm.writeInt16LE(Math.round(right * 32767), frame * 4 + 2);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  writeFileSync(
    join(work, "ajer-original-music.wav"),
    Buffer.concat([header, pcm]),
  );
}

createMusic();

const videoArgs = ["-y", "-loglevel", "error"];
for (let index = 0; index < scenes.length; index += 1) {
  videoArgs.push(
    "-loop",
    "1",
    "-t",
    "10.75",
    "-i",
    join(work, `scene-${index + 1}.png`),
  );
}
videoArgs.push("-i", join(work, "ajer-original-music.wav"));

const filters = scenes.map((_, index) => {
  const zoom =
    index % 2 === 0
      ? "min(zoom+0.00008,1.045)"
      : "if(eq(on,1),1.045,max(1.0,zoom-0.00008))";
  return `[${index}:v]scale=2048:1152,zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=323:s=1920x1080:fps=30,setsar=1[v${index}]`;
});
let previous = "v0";
for (let index = 1; index < scenes.length; index += 1) {
  const output = index === scenes.length - 1 ? "vfinal" : `vx${index}`;
  filters.push(
    `[${previous}][v${index}]xfade=transition=fade:duration=0.75:offset=${index * 10}[${output}]`,
  );
  previous = output;
}
filters.push(`[vfinal]trim=duration=90,format=yuv420p[outv]`);
filters.push(
  `[${scenes.length}:a]atrim=duration=90,afade=t=in:st=0:d=2,afade=t=out:st=85:d=5,alimiter=limit=0.92[outa]`,
);

const videoPath = join(outputDir, "ajer-demo-90s.mp4");
videoArgs.push(
  "-filter_complex",
  filters.join(";"),
  "-map",
  "[outv]",
  "-map",
  "[outa]",
  "-c:v",
  "libx264",
  "-preset",
  "slow",
  "-crf",
  "22",
  "-movflags",
  "+faststart",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  "-t",
  "90",
  videoPath,
);
execFileSync("ffmpeg", videoArgs, { stdio: "inherit" });

execFileSync(
  "ffmpeg",
  [
    "-y",
    "-loglevel",
    "error",
    "-i",
    videoPath,
    "-ss",
    "2",
    "-frames:v",
    "1",
    "-c:v",
    "libwebp",
    "-quality",
    "86",
    join(outputDir, "ajer-demo-poster.webp"),
  ],
  { stdio: "inherit" },
);

console.log(videoPath);
