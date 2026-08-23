import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Toaster } from "sonner";
export const metadata: Metadata = {
  title: {
    default: "آجر؛ سامانه نقشه‌محور مدیریت املاک",
    template: "%s | آجر",
  },
  description: "مدیریت یکپارچه فایل‌های ملکی، متقاضیان و معاملات در ارومیه",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        {children}
        <Toaster position="bottom-left" richColors />
      </body>
    </html>
  );
}
