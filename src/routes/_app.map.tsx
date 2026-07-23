import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { MapPin, Settings as SettingsIcon } from "lucide-react";

export const Route = createFileRoute("/_app/map")({
  head: () => ({ meta: [{ title: "Map — BloodLink" }] }),
  component: MapPage,
});

type Marker = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: "donor" | "request";
  blood_group: string | null;
};

declare global {
  interface Window {
    google?: any;
    __gmapsPromise?: Promise<void>;
  }
}

function loadGoogleMaps(key: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (window.__gmapsPromise) return window.__gmapsPromise;
  window.__gmapsPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("gmaps failed"));
    document.head.appendChild(s);
  });
  return window.__gmapsPromise;
}

function MapPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_settings")
      .select("google_maps_api_key")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.google_maps_api_key) setApiKey(data.google_maps_api_key);
      });
  }, [user]);

  useEffect(() => {
    async function load() {
      const [{ data: donors }, { data: reqs }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, latitude, longitude, blood_group, is_donor")
          .eq("is_donor", true)
          .not("latitude", "is", null),
        supabase
          .from("blood_requests")
          .select("id, patient_name, latitude, longitude, blood_group, status")
          .eq("status", "open")
          .not("latitude", "is", null),
      ]);
      const m: Marker[] = [];
      (donors ?? []).forEach((d: any) =>
        m.push({ id: `d-${d.id}`, name: d.full_name ?? "Donor", lat: d.latitude, lng: d.longitude, kind: "donor", blood_group: d.blood_group }),
      );
      (reqs ?? []).forEach((r: any) =>
        m.push({ id: `r-${r.id}`, name: r.patient_name, lat: r.latitude, lng: r.longitude, kind: "request", blood_group: r.blood_group }),
      );
      setMarkers(m);
    }
    load();
  }, []);

  useEffect(() => {
    if (!apiKey || !mapRef.current) return;
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !mapRef.current || !window.google) return;
        const center = markers[0] ? { lat: markers[0].lat, lng: markers[0].lng } : { lat: 23.8103, lng: 90.4125 };
        const map = new window.google.maps.Map(mapRef.current, {
          center,
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
        });
        markers.forEach((m) => {
          new window.google.maps.Marker({
            position: { lat: m.lat, lng: m.lng },
            map,
            title: `${m.name} (${m.blood_group ?? ""})`,
            label: {
              text: m.blood_group ?? "?",
              color: "#fff",
              fontSize: "11px",
              fontWeight: "700",
            },
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 14,
              fillColor: m.kind === "request" ? "#c1121f" : "#0a7d5f",
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 2,
            },
          });
        });
        setMapReady(true);
      })
      .catch(() => setMapReady(false));
    return () => {
      cancelled = true;
    };
  }, [apiKey, markers]);

  return (
    <div className="mx-auto max-w-md">
      <header className="sticky top-0 z-30 glass border-b safe-top">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-base font-bold flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-primary" />
            {t("map")}
          </h1>
          <Link to="/settings" className="text-xs text-muted-foreground flex items-center gap-1">
            <SettingsIcon className="h-3.5 w-3.5" /> API
          </Link>
        </div>
      </header>

      {!apiKey ? (
        <div className="p-6 text-center">
          <div className="mx-auto max-w-xs">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-muted grid place-items-center mb-3">
              <MapPin className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{t("addMapKeyPrompt")}</p>
            <Link
              to="/settings"
              className="mt-4 inline-flex rounded-full bg-primary text-primary-foreground text-xs font-semibold px-4 py-2"
            >
              {t("settings")}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div ref={mapRef} className="h-[calc(100dvh-160px)] w-full" />
          {!mapReady && (
            <p className="text-center text-xs text-muted-foreground py-4">{t("loading")}</p>
          )}
        </>
      )}
    </div>
  );
}
