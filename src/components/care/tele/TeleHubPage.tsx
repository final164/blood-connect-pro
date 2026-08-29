import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, Star, Video } from "lucide-react";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useI18n } from "@/lib/i18n";
import { fetchCareSpecialties, type CareSpecialty } from "@/lib/care-cms";
import { fetchTeleOfferCards, fetchTeleSettings, type TeleOfferCard, type TeleSettings } from "@/lib/tele-cms";
import { searchTeleDoctors, type TeleVideoDoctor } from "@/lib/tele-api";
import { formatCareMoney } from "@/lib/care-invoice";
import { useAuth } from "@/lib/auth-context";
import { fetchMyTeleBookings, type TeleBooking } from "@/lib/tele-api";

export function TeleHubPage() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const bn = lang === "bn";
  const [settings, setSettings] = useState<TeleSettings | null>(null);
  const [q, setQ] = useState("");
  const [offers, setOffers] = useState<TeleOfferCard[]>([]);
  const [popular, setPopular] = useState<TeleVideoDoctor[]>([]);
  const [specialists, setSpecialists] = useState<TeleVideoDoctor[]>([]);
  const [specs, setSpecs] = useState<CareSpecialty[]>([]);
  const [deptTab, setDeptTab] = useState<"departments" | "symptoms">("departments");
  const [myBookings, setMyBookings] = useState<TeleBooking[]>([]);

  useEffect(() => {
    void Promise.all([
      fetchTeleSettings(),
      fetchTeleOfferCards(true),
      searchTeleDoctors({ popularOnly: true }),
      searchTeleDoctors({}),
      fetchCareSpecialties(),
    ]).then(([s, o, pop, all, sp]) => {
      setSettings(s);
      setOffers(o);
      setPopular(pop);
      setSpecialists(all.slice(0, 12));
      setSpecs(sp.filter((x) => x.is_active));
    });
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void fetchMyTeleBookings(user.id).then(setMyBookings).catch(() => undefined);
  }, [user?.id]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void searchTeleDoctors({ q }).then(setSpecialists).catch(() => undefined);
    }, 250);
    return () => window.clearTimeout(t);
  }, [q]);

  if (settings && !settings.tele_enabled) {
    return (
      <div className="min-h-[50dvh] grid place-items-center px-4 text-sm text-muted-foreground">
        {bn ? "ভিডিও কনসালটেশন বর্তমানে বন্ধ আছে।" : "Video consultation is currently disabled."}
      </div>
    );
  }

  const ui = settings?.ui;

  return (
    <div className="w-full">
      <AutoHideHeader className="z-30 border-b bg-background/90 backdrop-blur-xl safe-top">
        <div className="flex items-center gap-2 px-3 py-2 max-w-2xl mx-auto w-full">
          <PageBackButton fallbackTo="/care" />
          <div className="h-8 w-8 rounded-xl bg-sky-100 text-sky-700 grid place-items-center">
            <Video className="h-4 w-4" />
          </div>
          <h1 className="text-sm font-bold truncate">
            {bn ? ui?.hub_title_bn : ui?.hub_title_en}
          </h1>
        </div>
      </AutoHideHeader>

      <div className="px-3 py-4 max-w-2xl mx-auto space-y-6 pb-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={bn ? ui?.search_placeholder_bn : ui?.search_placeholder_en}
            className="w-full rounded-2xl border bg-muted/30 pl-10 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500/30"
          />
        </div>

        {myBookings.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-bold">{bn ? "আমার ভিডিও বুকিং" : "My video bookings"}</h2>
            {myBookings.slice(0, 3).map((b) => (
              <Link
                key={b.id}
                to="/care/video/booking/$id"
                params={{ id: b.id }}
                className="flex items-center justify-between rounded-xl border px-3 py-2 text-xs hover:bg-muted/40"
              >
                <span className="font-medium capitalize">{b.status.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground">৳{b.net_amount}</span>
              </Link>
            ))}
          </section>
        )}

        <section className="space-y-2">
          <h2 className="text-sm font-bold">{bn ? ui?.instant_section_bn : ui?.instant_section_en}</h2>
          <div className="flex gap-3 overflow-x-auto pb-1 snap-x">
            {offers.map((o) => (
              <Link
                key={o.id}
                to="/care/video/checkout"
                search={{ mode: "instant", offerId: o.id, specialtyId: o.specialty_id ?? undefined }}
                className="snap-start shrink-0 w-44 rounded-2xl border overflow-hidden bg-sky-50/80"
              >
                <div className="h-24 bg-sky-100/80 grid place-items-center">
                  {o.image_url ? (
                    <img src={o.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Video className="h-8 w-8 text-sky-600" />
                  )}
                </div>
                <div className="p-2.5 space-y-1">
                  <p className="text-xs font-bold leading-snug line-clamp-2">{bn ? o.title_bn : o.title_en}</p>
                  <p className="text-sm font-bold text-sky-700">
                    {formatCareMoney(o.sale_price)}
                    {o.list_price && o.list_price > o.sale_price ? (
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground line-through">
                        {formatCareMoney(o.list_price)}
                      </span>
                    ) : null}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {popular.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">{bn ? "জনপ্রিয় বিশেষজ্ঞ" : "Popular Specialists"}</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {popular.map((d) => (
                <DoctorCard key={d.doctor_id} d={d} bn={bn} />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-2">
          <h2 className="text-sm font-bold">{bn ? ui?.specialist_section_bn : ui?.specialist_section_en}</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {specialists.map((d) => (
              <DoctorCard key={d.doctor_id} d={d} bn={bn} />
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold">{bn ? ui?.dept_section_bn : ui?.dept_section_en}</h2>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setDeptTab("departments")}
              className={`rounded-full px-3 py-1 font-semibold ${deptTab === "departments" ? "bg-sky-600 text-white" : "border"}`}
            >
              {bn ? "বিভাগ" : "Departments"}
            </button>
            <button
              type="button"
              onClick={() => setDeptTab("symptoms")}
              className={`rounded-full px-3 py-1 font-semibold ${deptTab === "symptoms" ? "bg-sky-600 text-white" : "border"}`}
            >
              {bn ? "লক্ষণ" : "Symptoms"}
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {specs.slice(0, 8).map((s) => (
              <Link
                key={s.id}
                to="/care/video/checkout"
                search={{ mode: "instant", specialtyId: s.id }}
                className="rounded-xl border p-2 text-center hover:bg-sky-50"
              >
                <div className="mx-auto mb-1 h-10 w-10 rounded-lg border border-sky-200 grid place-items-center text-sky-700">
                  <Video className="h-4 w-4" />
                </div>
                <p className="text-[10px] font-medium line-clamp-2">{bn ? s.name_bn : s.name_en}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function DoctorCard({ d, bn }: { d: TeleVideoDoctor; bn: boolean }) {
  return (
    <Link
      to="/care/video/doctor/$id"
      params={{ id: d.doctor_id }}
      className="snap-start shrink-0 w-40 rounded-2xl border overflow-hidden bg-card"
    >
      <div className="relative h-28 bg-muted">
        {d.photo_url || d.hero_image_url ? (
          <img src={d.hero_image_url || d.photo_url || ""} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full grid place-items-center text-muted-foreground text-xs">Dr</div>
        )}
        {d.experience_years != null && (
          <span className="absolute bottom-1 left-1 rounded bg-black/60 text-white text-[9px] px-1.5 py-0.5">
            {d.experience_years}+ {bn ? "বছর" : "Yrs"}
          </span>
        )}
      </div>
      <div className="p-2 space-y-0.5">
        <p className="text-xs font-bold line-clamp-1">{bn ? d.full_name_bn || d.full_name : d.full_name}</p>
        <p className="flex items-center gap-0.5 text-[10px] text-amber-600">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          {d.rating_avg || "—"} ({d.rating_count})
        </p>
        {(d.specialty_name_bn || d.specialty_name_en) && (
          <span className="inline-block rounded bg-sky-100 text-sky-800 text-[9px] px-1.5 py-0.5 font-medium">
            {bn ? d.specialty_name_bn : d.specialty_name_en}
          </span>
        )}
        <p className="text-sm font-bold text-sky-700">{formatCareMoney(d.fee_amount ?? 0)}</p>
        <p className="text-[10px] font-semibold text-sky-600">{bn ? "ডাক্তার দেখুন ›" : "See Doctor ›"}</p>
      </div>
    </Link>
  );
}
