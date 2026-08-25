import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  FlaskConical,
  LayoutGrid,
  Search,
  Stethoscope,
  Ticket,
  Microscope,
  Ambulance,
  Building2,
  Sparkles,
} from "lucide-react";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { UserMenuTrigger } from "@/components/menu/UserMenuDrawer";
import { ProfileHeaderButton } from "@/components/ProfileHeaderButton";
import { AlertsHeaderButton } from "@/components/MessengerIcon";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { useI18n } from "@/lib/i18n";
import type { District } from "@/lib/api";
import { fetchCareSpecialties, fetchTestCategories, locName } from "@/lib/care-cms";
import { CareHubNav } from "@/components/care/CareHubNav";
import {
  searchCareDoctors,
  fetchMySerials,
  type CareDoctorListItem,
} from "@/lib/care-api";
import { searchTestOfferings, searchLabFacilities, fetchMyLabBookings, type CareOffering, type CareLabFacility } from "@/lib/care-lab-api";
import { CareLabPriceDisplay } from "@/components/care/CareLabPriceDisplay";
import { formatCareMoney } from "@/lib/care-invoice";
import {
  CareLabProgressMini,
  summarizeLabGroupStatus,
} from "@/components/care/CareLabProgress";
import { fetchMyAmbulanceRequests } from "@/lib/ambulance-api";
import { useAuth } from "@/lib/auth-context";
import { CareCustomerDashboard } from "@/components/care/CareCustomerDashboard";

export function CareHubPage({
  initialTab,
  initialSpecialtyId,
}: {
  initialTab?: string;
  initialSpecialtyId?: string;
}) {
  const { lang, t } = useI18n();
  const { user } = useAuth();
  const [tab, setTab] = useState(initialTab || "dashboard");

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  return (
    <div className="w-full">
      <AutoHideHeader className="z-30 border-b bg-background/90 backdrop-blur-xl safe-top">
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <PageBackButton fallbackTo="/home" />
            <UserMenuTrigger />
            <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
              <LayoutGrid className="h-4 w-4" />
            </div>
            <h1 className="text-sm font-bold truncate">{t("careHub")}</h1>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <ProfileHeaderButton />
            <AlertsHeaderButton />
          </div>
        </div>
        <div className="px-3 pb-2">
          <CareHubNav lang={lang} activeTab={tab} includeDashboard variant="strip" />
        </div>
      </AutoHideHeader>

      <div className="px-3 sm:px-4 py-3 max-w-2xl mx-auto pb-8">
        {tab === "dashboard" ? (
          <CareCustomerDashboard lang={lang} userId={user?.id} />
        ) : tab === "tests" ? (
          <TestsPanel lang={lang} />
        ) : tab === "bookings" ? (
          <BookingsPanel lang={lang} userId={user?.id} />
        ) : tab === "ambulance" ? (
          <AmbulanceTabPanel lang={lang} />
        ) : (
          <DoctorsPanel lang={lang} initialSpecialtyId={initialSpecialtyId} />
        )}
      </div>
    </div>
  );
}

function DoctorsPanel({
  lang,
  initialSpecialtyId,
}: {
  lang: "bn" | "en";
  initialSpecialtyId?: string;
}) {
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState<District | null>(null);
  const [upazila, setUpazila] = useState("");
  const [specialtyId, setSpecialtyId] = useState(initialSpecialtyId || "");
  const [specialties, setSpecialties] = useState<{ id: string; name_bn: string; name_en: string }[]>([]);
  const [rows, setRows] = useState<CareDoctorListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchCareSpecialties().then(setSpecialties);
  }, []);

  useEffect(() => {
    if (initialSpecialtyId) setSpecialtyId(initialSpecialtyId);
  }, [initialSpecialtyId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      void searchCareDoctors({
        q,
        specialtyId: specialtyId || undefined,
        districtId: district?.id,
        upazila: upazila || undefined,
      })
        .then((list) => {
          if (!cancelled) setRows(list);
        })
        .catch(() => {
          if (!cancelled) setRows([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, specialtyId, district?.id, upazila]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={lang === "bn" ? "ডাক্তার, স্পেশালিটি, চেম্বার…" : "Doctor, specialty, chamber…"}
          className="w-full rounded-xl border bg-card pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <DistrictTypeahead value={district} onChange={setDistrict} />
        <input
          value={upazila}
          onChange={(e) => setUpazila(e.target.value)}
          placeholder={lang === "bn" ? "উপজেলা" : "Upazila"}
          className="rounded-xl border bg-card px-3 py-2 text-sm"
        />
      </div>
      <select
        value={specialtyId}
        onChange={(e) => setSpecialtyId(e.target.value)}
        className="w-full rounded-xl border bg-card px-3 py-2 text-sm"
      >
        <option value="">{lang === "bn" ? "সব স্পেশালিটি" : "All specialties"}</option>
        {specialties.map((s) => (
          <option key={s.id} value={s.id}>
            {lang === "bn" ? s.name_bn : s.name_en}
          </option>
        ))}
      </select>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-2xl border bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          {lang === "bn" ? "চেম্বার যোগ হবে — ভেরিফায়েড তালিকা শীঘ্রই।" : "Chambers will be listed here once verified."}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((d) => {
            const name = lang === "bn" ? d.full_name_bn || d.full_name : d.full_name;
            const spec = lang === "bn" ? d.specialty_name_bn : d.specialty_name_en;
            const chamber = d.chambers[0];
            return (
              <li key={d.id}>
                <Link
                  to="/care/doctor/$id"
                  params={{ id: d.id }}
                  className="flex items-start gap-3 rounded-2xl border bg-card px-3 py-3 hover:bg-muted/40 transition"
                >
                  <span className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0 overflow-hidden">
                    {d.photo_url ? (
                      <img src={d.photo_url} alt="" className="h-11 w-11 object-cover" />
                    ) : (
                      <Stethoscope className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {[spec, chamber ? locName({ name: chamber.location_name, name_bn: chamber.location_name_bn }, lang) : null, d.bmdc_no ? `BMDC ${d.bmdc_no}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TestsPanel({ lang }: { lang: "bn" | "en" }) {
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState<District | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [cats, setCats] = useState<{ id: string; name_bn: string; name_en: string }[]>([]);
  const [view, setView] = useState<"labs" | "tests">("tests");
  const [facilities, setFacilities] = useState<CareLabFacility[]>([]);
  const [rows, setRows] = useState<CareOffering[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchTestCategories().then(setCats);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      const opts = {
        q,
        districtId: district?.id,
        categoryId: categoryId || undefined,
      };
      const job =
        view === "labs"
          ? searchLabFacilities(opts).then((list) => {
              if (!cancelled) {
                setFacilities(list);
                setRows([]);
              }
            })
          : searchTestOfferings(opts).then((list) => {
              if (!cancelled) {
                setRows(list);
                setFacilities([]);
              }
            });
      void job
        .catch(() => {
          if (!cancelled) {
            setFacilities([]);
            setRows([]);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, district?.id, categoryId, view]);

  return (
    <div className="space-y-3">
      <Link
        to="/care/ai-tests"
        className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-3 py-3 hover:bg-primary/10"
      >
        <span className="h-11 w-11 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold">{lang === "bn" ? "AI সাজেশন" : "AI suggestion"}</p>
          <p className="text-[11px] text-muted-foreground">
            {lang === "bn"
              ? "লক্ষণ বলুন — ক্যাটালগ থেকে টেস্ট ও দামসহ বুকিং সাজেস্ট হবে।"
              : "Describe symptoms — get catalog tests and a priced booking plan."}
          </p>
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-1 rounded-xl border bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => setView("labs")}
          className={`rounded-lg px-2 py-2 text-xs font-bold ${view === "labs" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
        >
          {lang === "bn" ? "ক্লিনিক / হাসপাতাল" : "Clinics / labs"}
        </button>
        <button
          type="button"
          onClick={() => setView("tests")}
          className={`rounded-lg px-2 py-2 text-xs font-bold ${view === "tests" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
        >
          {lang === "bn" ? "সব টেস্ট" : "All tests"}
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={
            view === "labs"
              ? lang === "bn"
                ? "ক্লিনিক / হাসপাতাল / ল্যাব খুঁজুন…"
                : "Search clinic / hospital / lab…"
              : lang === "bn"
                ? "টেস্ট / প্যাকেজ খুঁজুন…"
                : "Search tests / packages…"
          }
          className="w-full rounded-xl border bg-card pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <DistrictTypeahead value={district} onChange={setDistrict} />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-xl border bg-card px-3 py-2 text-sm"
        >
          <option value="">{lang === "bn" ? "সব ক্যাটাগরি" : "All categories"}</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {lang === "bn" ? c.name_bn : c.name_en}
            </option>
          ))}
        </select>
      </div>

      {view === "labs" ? (
        loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 rounded-2xl border bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : facilities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            {lang === "bn" ? "ক্লিনিক/ল্যাব যোগ হবে — ভেরিফায়েড তালিকা শীঘ্রই।" : "Verified labs will appear here."}
          </p>
        ) : (
          <ul className="space-y-2">
            {facilities.map((f) => {
              const name = lang === "bn" ? f.name_bn || f.name : f.name;
              const kind = lang === "bn" ? f.kind_name_bn || f.kind_name_en : f.kind_name_en || f.kind_name_bn;
              return (
                <li key={f.id}>
                  <Link
                    to="/care/labs/$orgId"
                    params={{ orgId: f.id }}
                    className="flex items-start gap-3 rounded-2xl border bg-card px-3 py-3 hover:bg-muted/40"
                  >
                    <span className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {[kind, f.upazila].filter(Boolean).join(" · ")}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {lang === "bn"
                          ? `${f.offering_count}টি টেস্ট · শুরু ${formatCareMoney(f.from_price, lang)}`
                          : `${f.offering_count} tests · from ${formatCareMoney(f.from_price, lang)}`}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )
      ) : loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 rounded-2xl border bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          {lang === "bn" ? "কোনো টেস্ট পাওয়া যায়নি" : "No tests found"}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((o) => (
            <li key={o.id}>
              <Link
                to="/care/labs/$orgId"
                params={{ orgId: o.org_id }}
                search={{ select: o.id }}
                className="flex items-start gap-3 rounded-2xl border bg-card px-3 py-3 hover:bg-muted/40"
              >
                <span className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                  <FlaskConical className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">
                    {lang === "bn" ? o.catalog?.name_bn : o.catalog?.name_en}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {[o.catalog?.code, locName(o.org ?? {}, lang)].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-1.5">
                    <CareLabPriceDisplay
                      listPrice={o.price}
                      discountPercent={o.discount_percent}
                      lang={lang}
                      variant="inline"
                    />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BookingsPanel({ lang, userId }: { lang: "bn" | "en"; userId?: string }) {
  const [serials, setSerials] = useState<Awaited<ReturnType<typeof fetchMySerials>>>([]);
  const [labs, setLabs] = useState<Awaited<ReturnType<typeof fetchMyLabBookings>>>([]);
  const [ambulance, setAmbulance] = useState<Awaited<ReturnType<typeof fetchMyAmbulanceRequests>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void Promise.all([fetchMySerials(), fetchMyLabBookings(), fetchMyAmbulanceRequests()])
      .then(([s, l, a]) => {
        if (cancelled) return;
        setSerials(s);
        setLabs(l);
        setAmbulance(a);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!userId) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-sm text-muted-foreground">
          {lang === "bn" ? "বুকিং দেখতে লগইন করুন" : "Log in to see your bookings"}
        </p>
        <Link
          to="/auth"
          search={{ next: "/care?tab=bookings" } as never}
          className="inline-flex rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold"
        >
          {lang === "bn" ? "লগইন" : "Log in"}
        </Link>
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground text-center py-10">{lang === "bn" ? "লোড হচ্ছে…" : "Loading…"}</p>;
  }

  if (!serials.length && !labs.length && !ambulance.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        {lang === "bn" ? "এখনো কোনো বুকিং নেই" : "No bookings yet"}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {serials.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {lang === "bn" ? "সিরিয়াল" : "Serials"}
          </h2>
          <ul className="space-y-2">
            {serials.map((s) => (
              <li key={s.id}>
                <Link
                  to="/care/serial/$id"
                  params={{ id: s.id }}
                  className="block rounded-2xl border bg-card px-3 py-3 hover:bg-muted/40"
                >
                  <p className="text-sm font-semibold">
                    {s.status === "pending_approval" || s.serial_no == null
                      ? lang === "bn"
                        ? `অনলাইন #${s.online_serial_no ?? "—"} · অনুমোদন বাকি`
                        : `Online #${s.online_serial_no ?? "—"} · pending approval`
                      : lang === "bn"
                        ? `সিরিয়াল #${s.serial_no} · ${s.status}`
                        : `Serial #${s.serial_no} · ${s.status}`}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {s.session?.session_date} · {s.claim_code}
                    {s.online_serial_no != null && s.serial_no != null
                      ? lang === "bn"
                        ? ` · অনলাইন #${s.online_serial_no}`
                        : ` · online #${s.online_serial_no}`
                      : ""}
                    {s.fee_amount != null ? ` · ৳${s.fee_amount}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {labs.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {lang === "bn" ? "টেস্ট ইনভয়েস" : "Test invoices"}
          </h2>
          <ul className="space-y-2">
            {groupLabBookings(labs).map((g) => {
              const primary = g.items[0];
              const groupStatus = summarizeLabGroupStatus(g.items.map((b) => b.status));
              const title =
                g.items.length > 1
                  ? lang === "bn"
                    ? `${g.items.length}টি টেস্ট`
                    : `${g.items.length} tests`
                  : lang === "bn"
                    ? primary.offering?.name_bn || primary.offering?.name_en || "টেস্ট"
                    : primary.offering?.name_en || primary.offering?.name_bn || "Test";
              return (
                <li key={g.key}>
                  <Link
                    to="/care/lab-booking/$id"
                    params={{ id: primary.id }}
                    className="block rounded-2xl border bg-card px-3 py-3 hover:bg-muted/40 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold min-w-0 truncate">{title}</p>
                      <span className="text-[11px] font-bold tabular-nums text-primary shrink-0">
                        {formatCareMoney(g.total, lang)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {g.items.length > 1
                        ? primary.invoice_no || primary.reference_code
                        : primary.reference_code}
                      {primary.invoice_no && g.items.length === 1 ? ` · ${primary.invoice_no}` : ""}
                    </p>
                    <CareLabProgressMini status={groupStatus} lang={lang} />
                    {g.items.length > 1 && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {g.items
                          .map(
                            (b) =>
                              (lang === "bn" ? b.offering?.name_bn : b.offering?.name_en) ||
                              b.reference_code,
                          )
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {ambulance.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {lang === "bn" ? "অ্যাম্বুলেন্স" : "Ambulance"}
          </h2>
          <ul className="space-y-2">
            {ambulance.map((b) => (
              <li key={b.id}>
                <Link
                  to="/ambulance/request/$id"
                  params={{ id: b.id }}
                  className="block rounded-2xl border bg-card px-3 py-3 hover:bg-muted/40"
                >
                  <p className="text-sm font-semibold">{b.reference_code} · {b.status}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {b.mode}
                    {b.invoice_no ? ` · ${b.invoice_no}` : ""}
                    {b.estimated_fare != null ? ` · ৳${b.estimated_fare}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function groupLabBookings(labs: Awaited<ReturnType<typeof fetchMyLabBookings>>) {
  const map = new Map<string, typeof labs>();
  for (const b of labs) {
    const key = b.invoice_group_id || b.invoice_no || b.id;
    const list = map.get(key) ?? [];
    list.push(b);
    map.set(key, list);
  }
  return [...map.entries()].map(([key, items]) => ({
    key,
    items: items.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)),
    total: items.reduce((n, b) => n + Number(b.price ?? 0), 0),
  }));
}

function AmbulanceTabPanel({ lang }: { lang: "bn" | "en" }) {
  return (
    <div className="space-y-4 text-center py-6">
      <p className="text-sm text-muted-foreground">
        {lang === "bn" ? "জরুরি বা শিডিউল অ্যাম্বুলেন্স বুক করুন" : "Book emergency or scheduled ambulance"}
      </p>
      <Link to="/ambulance" className="inline-flex rounded-xl bg-orange-600 text-white px-6 py-3 text-sm font-bold">
        {lang === "bn" ? "অ্যাম্বুলেন্স হাব" : "Open ambulance hub"}
      </Link>
    </div>
  );
}
