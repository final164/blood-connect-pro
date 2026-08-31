import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Home, Loader2, MapPin } from "lucide-react";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { CareHomeLocationPicker } from "@/components/care/CareHomeLocationPicker";
import { useI18n } from "@/lib/i18n";
import { formatCareMoney } from "@/lib/care-invoice";
import {
  fetchHomeCareFlags,
  loadCachedHomeLocation,
  searchHomeDoctors,
  type CareHomeDoctorCard,
  type CareHomeLocation,
} from "@/lib/care-home-api";

export function CareHomeDoctorHubPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const [flagOn, setFlagOn] = useState<boolean | null>(null);
  const [loc, setLoc] = useState<CareHomeLocation | null>(() => loadCachedHomeLocation());
  const [doctors, setDoctors] = useState<CareHomeDoctorCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [editLoc, setEditLoc] = useState(!loadCachedHomeLocation());

  useEffect(() => {
    void fetchHomeCareFlags().then((f) => setFlagOn(f.home_doctor));
  }, []);

  useEffect(() => {
    if (!loc || editLoc) return;
    setLoading(true);
    void searchHomeDoctors({ districtId: loc.districtId, upazila: loc.upazila })
      .then(setDoctors)
      .catch(() => setDoctors([]))
      .finally(() => setLoading(false));
  }, [loc, editLoc]);

  if (flagOn === false) {
    return (
      <div className="min-h-[50dvh] grid place-items-center px-4 text-sm text-muted-foreground text-center">
        {bn ? "হোম ডাক্তার এখন বন্ধ আছে" : "Home Doctor is currently disabled"}
      </div>
    );
  }

  return (
    <div className="w-full min-h-dvh bg-gradient-to-b from-teal-50/80 via-background to-background">
      <AutoHideHeader className="z-30 border-b bg-background/90 backdrop-blur safe-top">
        <div className="flex items-center gap-2 px-3 py-2 max-w-2xl mx-auto w-full">
          <PageBackButton fallbackTo="/care" />
          <div className="h-8 w-8 rounded-xl bg-teal-100 text-teal-800 grid place-items-center">
            <Home className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold truncate">{bn ? "হোম ডাক্তার" : "Home Doctor"}</h1>
            <p className="text-[10px] text-muted-foreground truncate">
              {bn ? "বাড়িতে ডাক্তার ভিজিট" : "Doctor home visits"}
            </p>
          </div>
        </div>
      </AutoHideHeader>

      <div className="px-3 py-4 max-w-2xl mx-auto space-y-4 pb-24">
        {editLoc || !loc ? (
          <CareHomeLocationPicker
            bn={bn}
            variant="home_doctor"
            initial={loc}
            onConfirm={(l) => {
              setLoc(l);
              setEditLoc(false);
            }}
          />
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditLoc(true)}
              className="w-full flex items-center gap-2 rounded-2xl border bg-card px-3 py-2.5 text-left"
            >
              <MapPin className="h-4 w-4 text-teal-700 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">
                  {bn ? loc.districtNameBn || loc.districtName : loc.districtName} · {loc.upazila}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">{loc.address}</p>
              </div>
              <span className="text-[10px] font-semibold text-teal-800 shrink-0">
                {bn ? "বদলান" : "Change"}
              </span>
            </button>

            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
              </div>
            ) : !doctors.length ? (
              <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
                {bn
                  ? "এই এলাকায় এখন কোনো হোম ডাক্তার নেই"
                  : "No home doctors serve this area yet"}
              </div>
            ) : (
              <ul className="space-y-2">
                {doctors.map((d) => {
                  const name = bn ? d.full_name_bn || d.full_name : d.full_name;
                  return (
                    <li key={d.doctor_id}>
                      <Link
                        to="/care/home-doctor/$doctorId"
                        params={{ doctorId: d.doctor_id }}
                        className="flex gap-3 rounded-2xl border bg-card p-3 hover:border-teal-300 transition-colors"
                      >
                        <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted shrink-0">
                          {d.photo_url ? (
                            <img src={d.photo_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full grid place-items-center text-teal-700">
                              <Home className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold truncate">{name}</p>
                            {d.is_online && (
                              <span className="shrink-0 h-2 w-2 rounded-full bg-emerald-500" title="online" />
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {bn ? d.specialty_name_bn : d.specialty_name_en}
                            {d.public_bmdc ? ` · BMDC ${d.public_bmdc}` : ""}
                          </p>
                          <p className="text-xs font-semibold text-teal-800 mt-0.5">
                            {formatCareMoney(d.fee_amount, lang)}
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              · {d.visit_minutes} {bn ? "মি." : "min"}
                            </span>
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
