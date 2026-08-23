"use client";
import dynamic from "next/dynamic";
export const DynamicPropertyMap = dynamic(
  () => import("./map-view").then((m) => m.PropertyMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[420px] card grid place-items-center subtle">
        در حال آماده‌سازی نقشه…
      </div>
    ),
  },
);
export const DynamicLocationMap = dynamic(
  () => import("./map-view").then((m) => m.LocationMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-80 card grid place-items-center subtle">
        در حال آماده‌سازی نقشه…
      </div>
    ),
  },
);
