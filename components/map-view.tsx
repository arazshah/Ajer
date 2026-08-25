"use client";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
  useMapEvents,
  Marker,
} from "react-leaflet";
import Link from "next/link";
import L from "leaflet";
import { useEffect } from "react";
import { formatMoney } from "@/lib/format";
import { label } from "@/lib/labels";
type P = {
  id: string;
  code: string;
  title: string;
  latitude: number;
  longitude: number;
  neighborhood: string;
  area: number;
  status: string;
  transactionType: string;
  priceTotal?: string | null;
  depositAmount?: string | null;
  monthlyRent?: string | null;
  imageUrl?: string;
};
export function PropertyMap({
  properties,
  compact = false,
}: {
  properties: P[];
  compact?: boolean;
}) {
  return (
    <MapContainer
      center={[37.5527, 45.0761]}
      zoom={12}
      style={{ height: compact ? 280 : 620, width: "100%", borderRadius: 16 }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {properties.map((p) => (
        <CircleMarker
          key={p.id}
          center={[p.latitude, p.longitude]}
          radius={compact ? 6 : 9}
          pathOptions={{
            color: p.status === "ACTIVE" ? "#C65D35" : "#62728A",
            fillOpacity: 0.9,
            weight: 2,
          }}
        >
          <Popup>
            <div dir="rtl" className="w-56">
              {p.imageUrl && (
                // The authenticated file endpoint must receive the browser cookie directly.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.imageUrl}
                  alt={p.title}
                  className="w-full h-24 object-cover rounded-lg mb-2"
                />
              )}
              <b className="block text-base">{p.title}</b>
              <span className="subtle">
                {p.code} · {p.neighborhood}
              </span>
              <div className="my-2">
                {p.area} متر · {label(p.transactionType)}
              </div>
              <b>
                {formatMoney(
                  p.priceTotal
                    ? BigInt(p.priceTotal)
                    : p.depositAmount
                      ? BigInt(p.depositAmount)
                      : null,
                )}
              </b>
              <Link
                className="btn btn-primary w-full mt-3"
                href={`/properties/${p.id}`}
              >
                مشاهده فایل
              </Link>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
const icon = L.divIcon({
  className: "",
  html: '<div style="width:24px;height:24px;background:#c65d35;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px #0005"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});
function Picker({
  value,
  onChange,
}: {
  value: [number, number];
  onChange: (v: [number, number]) => void;
}) {
  useMapEvents({ click: (e) => onChange([e.latlng.lat, e.latlng.lng]) });
  return (
    <Marker
      draggable
      position={value}
      icon={icon}
      eventHandlers={{
        dragend: (e) => {
          const p = e.target.getLatLng();
          onChange([p.lat, p.lng]);
        },
      }}
    />
  );
}
function MapFocus({ value }: { value: [number, number] }) {
  const map = useMap();
  const lat = value[0];
  const lon = value[1];
  useEffect(() => {
    map.flyTo([lat, lon], Math.max(map.getZoom(), 15), { duration: 0.8 });
  }, [lat, lon, map]);
  return null;
}
export function LocationMap({
  value,
  onChange,
}: {
  value: [number, number];
  onChange: (v: [number, number]) => void;
}) {
  return (
    <MapContainer
      center={value}
      zoom={13}
      style={{ height: 320, borderRadius: 16 }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapFocus value={value} />
      <Picker value={value} onChange={onChange} />
    </MapContainer>
  );
}
