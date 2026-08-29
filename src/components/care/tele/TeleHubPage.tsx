import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, Star, Video } from "lucide-react";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useI18n } from "@/lib/i18n";
import { fetchCareSpecialties, type CareSpecialty } from "@/lib/care-cms";
import { fetchTeleOfferCards, fetchTeleSettings, type TeleOfferCard, type TeleSettings } from "@/lib/tele-cms";
import { searchTeleDoctors, fetchMyTeleBookings, type TeleVideoDoctor, type TeleBooking } from "@/lib/tele-api";
import { formatCareMoney } from "@/lib/care-invoice";
import { useAuth } from "@/lib/auth-context";
import { telePaymentLabel, teleStatusLabel, teleStatusTone } from "@/lib/tele-status";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([
      fetchTeleSettings(),
      fetchTeleOfferCards(true),
      searchTeleDoctors({ popularOnly: true }),
      searchTeleDoctors({}),
      fetchCareSpecialties(),
    ])
      .then(([s, o, pop, all, sp]) => {
        setSettings(s);
        setOffers(s.instant_enabled === false ? [] : o);
        setPopular(pop);
        setSpecialists(all.slice(0, 12));
        setSpecs(sp.filter((x) => x.is_active));
      })
      .finally(() => setLoading(false));
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

  const ui = settings?.ui;

  if (!loading && settings && !settings.tele_enabled) {
    return (
      <div className="min-h-[50dvh] grid place-items-center px-4 text-sm text-muted-foreground text-center">
        {bn ? ui?.disabled_message_bn : ui?.disabled_message_en}
      </div>
    );
  }

  return (
    <div className="w-full min-h-dvh bg-linear-to-b from-sky-50/80 via-background to-background">
      <AutoHideHeader className="z-30 border-b bg-background/90 backdrop-blur-xl safe-top">
        <div className="flex items-center gap-2 px-3 py-2 max-w-2xl mx-auto w-full">
          <PageBackButton fallbackTo="/care" />
          <div className="h-8 w-8 rounded-xl bg-sky-100 text-sky-700 grid place-items-center ring-1 ring-sky-200/80">
            <Video className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold truncate">{bn ? ui?.hub_title_bn : ui?.hub_title_en}</h1>
            <p className="text-[10px] text-muted-foreground truncate">
              {bn ? ui?.hub_subtitle_bn : ui?.hub_subtitle_en}
            </p>
          </div>
        </div>
      </AutoHideHeader>

      <div className="px-3 py-4 max-w-2xl mx-auto space-y-7 pb-12">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={bn ? ui?.search_placeholder_bn : ui?.search_placeholder_en}
            className="w-full rounded-2xl border border-sky-100 bg-white/90 shadow-sm pl-10 pr-3 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500/25"
          />
        </div>

        {(settings?.trust_bullets_bn?.length || settings?.trust_bullets_en?.length) ? (
          <ul className="flex flex-wrap gap-2">
            {(bn ? settings.trust_bullets_bn : settings.trust_bullets_en).slice(0, 4).map((t) => (
              <li
                key={t}
                className="rounded-full bg-white/90 border border-sky-100 px-2.5 py-1 text-[10px] font-medium text-sky-900"
              >
                {t}
              </li>
            ))}
          </ul>
        ) : null}

        {myBookings.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-bold tracking-tight">{bn ? ui?.my_bookings_bn : ui?.my_bookings_en}</h2>
            <div className="space-y-2">
              {myBookings.slice(0, 3).map((b) => (
                <Link
                  key={b.id}
                  to="/care/video/booking/$id"
                  params={{ id: b.id }}
                  className="flex items-center justify-between rounded-2xl border bg-white/90 px-3 py-2.5 text-xs shadow-sm hover:border-sky-300 transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${teleStatusTone(b.status)}`}>
                      {teleStatusLabel(b.status, bn)}
                    </span>
                    {b.slot_start && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {new Date(b.slot_start).toLocaleString(bn ? "bn-BD" : "en-US", {
                          timeZone: "Asia/Dhaka",
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sky-800">{formatCareMoney(b.net_amount)}</p>
                    <p className="text-[9px] text-muted-foreground">{telePaymentLabel(b.payment_status, bn)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {offers.length > 0 && (
          <section className="space-y-2.5">
            <h2 className="text-sm font-bold tracking-tight">{bn ? ui?.instant_section_bn : ui?.instant_section_en}</h2>
            <div className="flex gap-3 overflow-x-auto pb-1 snap-x">
              {offers.map((o) => (
                <Link
                  key={o.id}
                  to="/care/video/checkout"
                  search={{ mode: "instant", offerId: o.id, specialtyId: o.specialty_id ?? undefined }}
                  className="snap-start shrink-0 w-44 rounded-2xl border border-sky-100 overflow-hidden bg-white shadow-sm ring-1 ring-sky-50"
                >
                  <div className="h-24 bg-linear-to-br from-sky-100 to-sky-50 grid place-items-center">
                    {o.image_url ? (
                      <img src={o.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Video className="h-8 w-8 text-sky-600" />
                    )}
                  </div>
                  <div className="p-2.5 space-y-1">
                    <p className="text-xs font-bold leading-snug line-clamp-2">{bn ? o.title_bn : o.title_en}</p>
                    {(bn ? o.subtitle_bn : o.subtitle_en) && (
                      <p className="text-[10px] text-muted-foreground line-clamp-1">
                        {bn ? o.subtitle_bn : o.subtitle_en}
                      </p>
                    )}
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
        )}

        {popular.length > 0 && (
          <section className="space-y-2.5">
            <h2 className="text-sm font-bold tracking-tight">{bn ? ui?.popular_section_bn : ui?.popular_section_en}</h2>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {popular.map((d) => (
                <DoctorCard key={d.doctor_id} d={d} bn={bn} seeLabel={bn ? ui?.see_doctor_bn : ui?.see_doctor_en} />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-2.5">
          <h2 className="text-sm font-bold tracking-tight">{bn ? ui?.specialist_section_bn : ui?.specialist_section_en}</h2>
          {specialists.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center rounded-2xl border border-dashed">
              {bn ? "কোনো ডাক্তার পাওয়া যায়নি" : "No doctors found"}
            </p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {specialists.map((d) => (
                <DoctorCard key={d.doctor_id} d={d} bn={bn} seeLabel={bn ? ui?.see_doctor_bn : ui?.see_doctor_en} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2.5">
          <h2 className="text-sm font-bold tracking-tight">{bn ? ui?.dept_section_bn : ui?.dept_section_en}</h2>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setDeptTab("departments")}
              className={`rounded-full px-3 py-1.5 font-semibold transition-colors ${
                deptTab === "departments" ? "bg-sky-600 text-white shadow-sm" : "border bg-white"
              }`}
            >
              {bn ? "বিভাগ" : "Departments"}
            </button>
            <button
              type="button"
              onClick={() => setDeptTab("symptoms")}
              className={`rounded-full px-3 py-1.5 font-semibold transition-colors ${
                deptTab === "symptoms" ? "bg-sky-600 text-white shadow-sm" : "border bg-white"
              }`}
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
                className="rounded-2xl border bg-white p-2.5 text-center shadow-sm hover:border-sky-300 hover:bg-sky-50/50 transition-colors"
              >
                <div className="mx-auto mb-1.5 h-10 w-10 rounded-xl bg-sky-50 border border-sky-100 grid place-items-center text-sky-700">
                  <Video className="h-4 w-4" />
                </div>
                <p className="text-[10px] font-semibold leading-tight line-clamp-2">{bn ? s.name_bn : s.name_en}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function DoctorCard({
  d,
  bn,
  seeLabel,
}: {
  d: TeleVideoDoctor;
  bn: boolean;
  seeLabel?: string;
}) {
  return (
    <Link
      to="/care/video/doctor/$id"
      params={{ id: d.doctor_id }}
      className="snap-start shrink-0 w-40 rounded-2xl border bg-white overflow-hidden shadow-sm ring-1 ring-black/3 hover:ring-sky-200 transition-shadow"
    >
      <div className="relative h-28 bg-muted">
        {d.photo_url || d.hero_image_url ? (
          <img src={d.hero_image_url || d.photo_url || ""} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full grid place-items-center text-muted-foreground text-xs font-semibold">Dr</div>
        )}
        {d.is_online && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" title="Online" />
        )}
        {d.experience_years != null && (
          <span className="absolute bottom-1 left-1 rounded-md bg-black/55 text-white text-[9px] font-medium px-1.5 py-0.5 backdrop-blur-sm">
            {d.experience_years}+ {bn ? "বছর" : "Yrs"}
          </span>
        )}
      </div>
      <div className="p-2.5 space-y-1">
        <p className="text-xs font-bold line-clamp-1 leading-snug">{bn ? d.full_name_bn || d.full_name : d.full_name}</p>
        <p className="flex items-center gap-0.5 text-[10px] text-amber-600 font-medium">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          {Number(d.rating_avg || 0).toFixed(1)}
          <span className="text-muted-foreground font-normal">({d.rating_count})</span>
        </p>
        {(d.specialty_name_bn || d.specialty_name_en) && (
          <span className="inline-block rounded-md bg-sky-50 text-sky-800 text-[9px] px-1.5 py-0.5 font-semibold">
            {bn ? d.specialty_name_bn : d.specialty_name_en}
          </span>
        )}
        <p className="text-sm font-bold text-sky-700 pt-0.5">{formatCareMoney(d.fee_amount ?? 0)}</p>
        <p className="text-[10px] font-semibold text-sky-600">{seeLabel}</p>
      </div>
    </Link>
  );
}
