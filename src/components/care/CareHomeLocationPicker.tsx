import { useEffect, useState } from "react";
import { Crosshair, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { UpazilaSelect } from "@/components/district/UpazilaSelect";
import type { District } from "@/lib/api";
import { fetchDistricts } from "@/lib/api";
import {
  fetchGoogleMapsApiKey,
  loadCachedHomeLocation,
  saveCachedHomeLocation,
  type CareHomeLocation,
} from "@/lib/care-home-api";
import { cn } from "@/lib/utils";

type Variant = "home_doctor" | "home_diagnostic";

type Props = {
  bn: boolean;
  variant: Variant;
  initial?: CareHomeLocation | null;
  onConfirm: (loc: CareHomeLocation) => void;
  confirmLabel?: string;
  className?: string;
  /** Compact form without hero (embedded in sheets) */
  compact?: boolean;
};

const HERO: Record<
  Variant,
  { titleBn: string; titleEn: string; subBn: string; subEn: string; img: string }
> = {
  home_doctor: {
    titleBn: "হোম ডাক্তার",
    titleEn: "Home Doctor",
    subBn: "বাড়িতে ডাক্তার ভিজিট — আপনার ঠিকানা দিন",
    subEn: "Doctor visits at home — share your location",
    img: "/landing/care-team.jpg",
  },
  home_diagnostic: {
    titleBn: "হোম ডায়াগনস্টিক",
    titleEn: "Home Diagnostic",
    subBn: "বাড়ি থেকে স্যাম্পল কালেকশন — লোকেশন নিশ্চিত করুন",
    subEn: "Home sample collection — confirm your location",
    img: "/landing/lab.jpg",
  },
};

export function CareHomeLocationPicker({
  bn,
  variant,
  initial,
  onConfirm,
  confirmLabel,
  className,
  compact,
}: Props) {
  const hero = HERO[variant];
  const cached = initial ?? loadCachedHomeLocation();
  const [district, setDistrict] = useState<District | null>(null);
  const [upazila, setUpazila] = useState(cached?.upazila ?? "");
  const [address, setAddress] = useState(cached?.address ?? "");
  const [lat, setLat] = useState<number | null>(cached?.lat ?? null);
  const [lng, setLng] = useState<number | null>(cached?.lng ?? null);
  const [mapsKey, setMapsKey] = useState<string | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [hydrating, setHydrating] = useState(!!cached?.districtId);

  useEffect(() => {
    void fetchGoogleMapsApiKey().then(setMapsKey).catch(() => setMapsKey(null));
  }, []);

  useEffect(() => {
    if (!cached?.districtId) {
      setHydrating(false);
      return;
    }
    let cancelled = false;
    void fetchDistricts("")
      .then((list) => {
        if (cancelled) return;
        const d = list.find((x) => x.id === cached.districtId) ?? null;
        setDistrict(d);
      })
      .finally(() => {
        if (!cancelled) setHydrating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cached?.districtId]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error(bn ? "জিওলোকেশন সাপোর্ট নেই" : "Geolocation not supported");
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGeoBusy(false);
        toast.success(bn ? "লোকেশন সেট হয়েছে" : "Location set");
      },
      () => {
        setGeoBusy(false);
        toast.error(bn ? "লোকেশন পাওয়া যায়নি" : "Could not get location");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  function confirm() {
    if (!district?.id) {
      toast.error(bn ? "জেলা নির্বাচন করুন" : "Select a district");
      return;
    }
    if (!upazila.trim()) {
      toast.error(bn ? "উপজেলা নির্বাচন করুন" : "Select an upazila");
      return;
    }
    if (!address.trim()) {
      toast.error(bn ? "ঠিকানা লিখুন" : "Enter address");
      return;
    }
    const loc: CareHomeLocation = {
      districtId: district.id,
      districtName: district.name_en,
      districtNameBn: district.name_bn,
      upazila: upazila.trim(),
      address: address.trim(),
      lat,
      lng,
    };
    saveCachedHomeLocation(loc);
    onConfirm(loc);
  }

  const mapSrc =
    lat != null && lng != null
      ? mapsKey
        ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(mapsKey)}&q=${lat},${lng}&zoom=15`
        : `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01}%2C${lat - 0.01}%2C${lng + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lng}`
      : null;

  return (
    <div className={cn("space-y-4", className)}>
      {!compact && (
        <div className="relative overflow-hidden rounded-2xl border bg-card min-h-[140px]">
          <img
            src={hero.img}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/50 to-teal-900/30" />
          <div className="relative z-10 px-4 py-6 text-white">
            <p className="text-2xl font-black tracking-tight">{bn ? hero.titleBn : hero.titleEn}</p>
            <p className="mt-1 text-sm text-white/85 max-w-md">{bn ? hero.subBn : hero.subEn}</p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="flex items-start gap-2">
          <div className="h-9 w-9 rounded-xl bg-teal-100 text-teal-800 grid place-items-center shrink-0">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold">
              {variant === "home_diagnostic"
                ? bn
                  ? "স্যাম্পল কালেকশন লোকেশন"
                  : "Sample collection location"
                : bn
                  ? "ভিজিট লোকেশন"
                  : "Visit location"}
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {bn
                ? "জেলা, উপজেলা ও সম্পূর্ণ ঠিকানা আবশ্যক। ম্যাপ ঐচ্ছিক।"
                : "District, upazila and full address are required. Map is optional."}
            </p>
          </div>
        </div>

        {hydrating ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-teal-700" />
          </div>
        ) : (
          <>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">
                {bn ? "জেলা *" : "District *"}
              </label>
              <DistrictTypeahead
                value={district}
                onChange={(d) => {
                  setDistrict(d);
                  setUpazila("");
                }}
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">
                {bn ? "উপজেলা *" : "Upazila *"}
              </label>
              <UpazilaSelect
                district={district}
                value={upazila}
                onChange={setUpazila}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">
                {bn ? "ঠিকানা *" : "Address *"}
              </label>
              <textarea
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm min-h-[72px] outline-none focus:ring-2 focus:ring-teal-600/25"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={
                  bn ? "বাড়ি/রোড, ল্যান্ডমার্ক…" : "House/road, landmark…"
                }
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={useMyLocation}
                disabled={geoBusy}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-60"
              >
                {geoBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Crosshair className="h-3.5 w-3.5" />
                )}
                {bn ? "আমার লোকেশন ব্যবহার" : "Use my location"}
              </button>
              {lat != null && lng != null && (
                <span className="text-[10px] text-muted-foreground self-center">
                  {lat.toFixed(5)}, {lng.toFixed(5)}
                </span>
              )}
            </div>

            {mapSrc && (
              <div className="overflow-hidden rounded-xl border aspect-video bg-muted">
                <iframe title="map" src={mapSrc} className="h-full w-full border-0" loading="lazy" />
              </div>
            )}

            <button
              type="button"
              onClick={confirm}
              className="w-full rounded-xl bg-teal-700 text-white py-2.5 text-sm font-bold hover:bg-teal-800"
            >
              {confirmLabel ?? (bn ? "লোকেশন নিশ্চিত করুন" : "Confirm location")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
