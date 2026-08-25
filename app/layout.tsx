import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Toaster } from "sonner";
export const metadata: Metadata = {
  title: {
    default: "آجر؛ سیستم مدیریت حرفه‌ای مشاوران املاک",
    template: "%s | آجر",
  },
  description:
    "آجر، سیستم مدیریت حرفه‌ای فایل، مالک، مستأجر، پیگیری و معاملات برای مشاوران املاک سراسر ایران",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
          rel="stylesheet"
          type="text/css"
        />
      </head>
      <body>
        {children}
        <Toaster position="bottom-left" richColors />
      </body>
    </html>
  );
}
