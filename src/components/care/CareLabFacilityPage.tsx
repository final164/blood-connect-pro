import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Building2, Check, FlaskConical, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { formatCareMoney } from "@/lib/care-invoice";
import {
  ensurePatientLabDay,
  fetchLabFacility,
  remainingSeats,
  reserveLabBundle,
  searchTestOfferings,
  setLabHomeCollection,
  type CareLabFacility,
  type CareOffering,
} from "@/lib/care-lab-api";
import { offeringSalePrice } from "@/lib/care-lab-price";
import { CareLabPriceDisplay } from "@/components/care/CareLabPriceDisplay";
import { CareOrgChatButton } from "@/components/care/CareOrgChatButton";
import { CareInstituteDetailsSheet } from "@/components/care/CareInstituteDetailsSheet";
import { clampPhoneDigits } from "@/lib/phone-auth";
import { cn } from "@/lib/utils";
import {
  loadCachedHomeLocation,
  type CareHomeLocation,
} from "@/lib/care-home-api";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

function isoDateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nextDates(count = 14) {
  const out: string[] = [];
  const from = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    out.push(isoDateLocal(d));
  }
  return out;
}

export function CareLabFacilityPage({
  orgId,
  initialSelectId,
  initialSelectIds,
  initialCatalogIds,
  homeOnly = false,
}: {
  orgId: string;
  initialSelectId?: string;
  initialSelectIds?: string[];
  initialCatalogIds?: string[];
  /** Only home_collection offerings; persist collection address on book */
  homeOnly?: boolean;
}) {
  const { lang } = useI18n();
  const { session, user, isAnonymous } = useAuth();
  const navigate = useNavigate();
  const [facility, setFacility] = useState<CareLabFacility | null>(null);
  const [offerings, setOfferings] = useState<CareOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(() => isoDateLocal(new Date()));
  const [busy, setBusy] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientSex, setPatientSex] = useState("");
  const [patientAddress, setPatientAddress] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [homeLoc, setHomeLoc] = useState<CareHomeLocation | null>(() =>
    homeOnly ? loadCachedHomeLocation() : null,
  );
  const dates = useMemo(() => nextDates(14), []);

  useEffect(() => {
    if (homeOnly) setHomeLoc(loadCachedHomeLocation());
  }, [homeOnly]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([fetchLabFacility(orgId), searchTestOfferings({ orgId })])
      .then(([f, list]) => {
        if (cancelled) return;
        setFacility(f);
        const filtered = homeOnly ? list.filter((o) => o.home_collection) : list;
        setOfferings(filtered);
        const next = new Set<string>();
        const offeringIds = [
          ...(initialSelectIds ?? []),
          ...(initialSelectId ? [initialSelectId] : []),
        ];
        for (const id of offeringIds) {
          if (filtered.some((o) => o.id === id)) next.add(id);
        }
        if (initialCatalogIds?.length) {
          const want = new Set(initialCatalogIds);
          const cheapestByCatalog = new Map<string, CareOffering>();
          for (const o of filtered) {
            if (!want.has(o.catalog_id)) continue;
            const prev = cheapestByCatalog.get(o.catalog_id);
            if (!prev || offeringSalePrice(o) < offeringSalePrice(prev)) {
              cheapestByCatalog.set(o.catalog_id, o);
            }
          }
          for (const o of cheapestByCatalog.values()) next.add(o.id);
        }
        if (next.size) setSelected(next);
      })
      .catch(() => {
        if (cancelled) return;
        setFacility(null);
        setOfferings([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    orgId,
    homeOnly,
    initialSelectId,
    // Stabilize array deps from search params
    initialSelectIds?.join(","),
    initialCatalogIds?.join(","),
  ]);

  useEffect(() => {
    if (!user?.id || isAnonymous) {
      setProfileLoaded(true);
      return;
    }
    let cancelled = false;
    void supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const p = data as { full_name?: string | null; phone?: string | null } | null;
        if (p) {
          setPatientName((prev) => prev || (p.full_name ?? "").trim());
          setPatientPhone((prev) => prev || clampPhoneDigits(p.phone ?? ""));
        }
        setProfileLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, isAnonymous]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return offerings;
    return offerings.filter((o) => {
      const hay = `${o.catalog?.code ?? ""} ${o.catalog?.name_bn ?? ""} ${o.catalog?.name_en ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [offerings, q]);

  const selectedOfferings = useMemo(
    () => offerings.filter((o) => selected.has(o.id)),
    [offerings, selected],
  );

  const total = useMemo(
    () => selectedOfferings.reduce((n, o) => n + offeringSalePrice(o), 0),
    [selectedOfferings],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        if (next.size >= 20) {
          toast.error(lang === "bn" ? "সর্বোচ্চ ২০টি টেস্ট" : "Maximum 20 tests");
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  }

  function openCheckout() {
    if (!selectedOfferings.length) {
      toast.error(lang === "bn" ? "কমপক্ষে একটি টেস্ট বেছে নিন" : "Select at least one test");
      return;
    }
    if (homeOnly) {
      const loc = homeLoc ?? loadCachedHomeLocation();
      if (!loc) {
        toast.error(
          lang === "bn" ? "আগে হোম কালেকশন লোকেশন সেট করুন" : "Set home collection location first",
        );
        void navigate({ to: "/care/home-diagnostic" });
        return;
      }
      setHomeLoc(loc);
      if (!patientAddress.trim()) setPatientAddress(loc.address);
    }
    if (!session || isAnonymous) {
      const next =
        initialSelectId != null
          ? `/care/labs/${orgId}?select=${encodeURIComponent(initialSelectId)}${homeOnly ? "&home=1" : ""}`
          : `/care/labs/${orgId}${homeOnly ? "?home=1" : ""}`;
      void navigate({
        to: "/auth",
        search: { next } as never,
      });
      return;
    }
    setCheckoutOpen(true);
  }

  async function confirmBook() {
    if (!selectedOfferings.length) {
      toast.error(lang === "bn" ? "কমপক্ষে একটি টেস্ট বেছে নিন" : "Select at least one test");
      return;
    }
    if (!session || isAnonymous) {
      void navigate({
        to: "/auth",
        search: { next: `/care/labs/${orgId}${homeOnly ? "?home=1" : ""}` } as never,
      });
      return;
    }

    const loc = homeOnly ? homeLoc ?? loadCachedHomeLocation() : null;
    if (homeOnly && !loc) {
      toast.error(
        lang === "bn" ? "কালেকশন লোকেশন প্রয়োজন" : "Collection location required",
      );
      void navigate({ to: "/care/home-diagnostic" });
      return;
    }

    const name = patientName.trim();
    const phone = clampPhoneDigits(patientPhone);
    if (!name) {
      toast.error(lang === "bn" ? "রোগীর নাম দিন" : "Enter patient name");
      return;
    }
    if (phone.length > 0 && phone.length < 11) {
      toast.error(lang === "bn" ? "সঠিক মোবাইল নম্বর দিন" : "Enter a valid mobile number");
      return;
    }

    setBusy(true);
    try {
      const calendarIds: string[] = [];
      for (const o of selectedOfferings) {
        const cal = await ensurePatientLabDay(o.id, date);
        if (remainingSeats(cal) <= 0) {
          const testName = lang === "bn" ? o.catalog?.name_bn : o.catalog?.name_en;
          throw new Error(
            lang === "bn"
              ? `${testName ?? "টেস্ট"} — এই তারিখে স্লট পূর্ণ`
              : `${testName ?? "Test"} — slot full on this date`,
          );
        }
        calendarIds.push(cal.id);
      }

      const ageNum = patientAge.trim() ? Number(patientAge) : null;
      const result = await reserveLabBundle({
        calendarIds,
        source: "app",
        guestName: name,
        guestPhone: phone || undefined,
        guestAge: ageNum != null && Number.isFinite(ageNum) ? ageNum : null,
        guestSex: patientSex || null,
        guestAddress: patientAddress.trim() || loc?.address || null,
        referredBy: referredBy.trim() || null,
      });

      if (homeOnly && loc) {
        await setLabHomeCollection({
          invoiceGroupId: result.invoice_group_id,
          districtId: loc.districtId,
          upazila: loc.upazila,
          address: loc.address,
          lat: loc.lat,
          lng: loc.lng,
        });
      }

      setCheckoutOpen(false);
      toast.success(
        lang === "bn"
          ? `${result.count}টি টেস্ট · এক ইনভয়েস ${result.invoice_no}`
          : `${result.count} tests · one invoice ${result.invoice_no}`,
      );
      void navigate({
        to: "/care/lab-booking/$id",
        params: { id: result.primary_booking_id },
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const title =
    lang === "bn"
      ? facility?.name_bn || facility?.name || "ল্যাব"
      : facility?.name || facility?.name_bn || "Lab";
  const kind =
    lang === "bn"
      ? facility?.kind_name_bn || facility?.kind_name_en
      : facility?.kind_name_en || facility?.kind_name_bn;

  return (
    <div className="w-full pb-28">
      <AutoHideHeader className="z-30 border-b bg-background safe-top">
        <div className="flex items-center gap-2 px-3 py-2">
          <PageBackButton
            fallbackTo={
              homeOnly
                ? { to: "/care/home-diagnostic" }
                : { to: "/care", search: { tab: "tests" } }
            }
            shape="xl"
          />
          <h1 className="text-sm font-bold truncate">
            {homeOnly ? (lang === "bn" ? "হোম · " : "Home · ") : ""}
            {title}
          </h1>
        </div>
      </AutoHideHeader>

      <div className="px-3 py-4 max-w-2xl mx-auto space-y-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-24 rounded-2xl border bg-muted/40 animate-pulse" />
            <div className="h-16 rounded-2xl border bg-muted/40 animate-pulse" />
          </div>
        ) : !facility ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            {lang === "bn" ? "ল্যাব পাওয়া যায়নি" : "Lab not found"}
          </p>
        ) : (
          <>
            <div className="rounded-2xl border bg-card p-4 flex gap-3">
              {facility.logo_url ? (
                <img
                  src={facility.logo_url}
                  alt=""
                  className="h-12 w-12 rounded-xl object-cover shrink-0 border bg-muted"
                />
              ) : (
                <span className="h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Building2 className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-snug">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {[kind, facility.upazila, facility.address].filter(Boolean).join(" · ")}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {lang === "bn"
                    ? `${facility.offering_count}টি টেস্ট উপলব্ধ · একাধিক বেছে এক ইনভয়েস`
                    : `${facility.offering_count} tests available · multi-select, one invoice`}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailsOpen(true)}
                    className="rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-muted"
                  >
                    {lang === "bn" ? "বিস্তারিত" : "Details"}
                  </button>
                  <CareOrgChatButton
                    orgId={facility.id}
                    phone={facility.phone}
                    orgLabel={title}
                    variant="button"
                  />
                </div>
              </div>
            </div>

            <CareInstituteDetailsSheet
              orgId={facility.id}
              open={detailsOpen}
              onOpenChange={setDetailsOpen}
              lang={lang}
            />

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={lang === "bn" ? "এই ল্যাবে টেস্ট খুঁজুন…" : "Search tests at this lab…"}
              className="w-full rounded-xl border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />

            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                {lang === "bn" ? "কোনো টেস্ট নেই" : "No tests found"}
              </p>
            ) : (
              <ul className="space-y-2">
                {filtered.map((o) => {
                  const on = selected.has(o.id);
                  const name = lang === "bn" ? o.catalog?.name_bn : o.catalog?.name_en;
                  return (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => toggle(o.id)}
                        className={cn(
                          "w-full flex items-start gap-3 rounded-2xl border px-3 py-3 text-left transition",
                          on ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/40",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 h-5 w-5 rounded-md border grid place-items-center shrink-0",
                            on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30",
                          )}
                        >
                          {on ? <Check className="h-3.5 w-3.5" /> : null}
                        </span>
                        <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                          <FlaskConical className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold truncate">{name}</span>
                          <span className="block text-[11px] text-muted-foreground truncate">
                            {[o.catalog?.code, o.location ? (lang === "bn" ? o.location.name_bn || o.location.name : o.location.name) : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                          <span className="mt-1.5 block">
                            <CareLabPriceDisplay
                              listPrice={o.price}
                              discountPercent={o.discount_percent}
                              lang={lang}
                              variant="inline"
                            />
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>

      {selectedOfferings.length > 0 && !checkoutOpen && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur safe-bottom">
          <div className="max-w-2xl mx-auto px-3 py-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate">
                {lang === "bn"
                  ? `${selectedOfferings.length}টি টেস্ট নির্বাচিত`
                  : `${selectedOfferings.length} tests selected`}
              </p>
              <p className="text-sm font-black tabular-nums text-primary">
                {formatCareMoney(total, lang)}
                <span className="ml-1 text-[10px] font-semibold text-muted-foreground">
                  {lang === "bn" ? "· এক ইনভয়েস" : "· one invoice"}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={openCheckout}
              className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-bold shrink-0"
            >
              {lang === "bn" ? "পরবর্তী · ফর্ম" : "Next · form"}
            </button>
          </div>
        </div>
      )}

      <Sheet open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl px-0 pb-safe">
          <SheetHeader className="px-4 text-left space-y-1">
            <SheetTitle>
              {lang === "bn" ? "বুকিং ফর্ম" : "Booking form"}
            </SheetTitle>
            <SheetDescription>
              {lang === "bn"
                ? "তারিখ ও রোগীর তথ্য দিন — তারপর এক ইনভয়েস তৈরি হবে।"
                : "Enter date and patient details — then one invoice will be created."}
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 py-4 space-y-4">
            <div className="rounded-2xl border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {lang === "bn" ? "নির্বাচিত টেস্ট" : "Selected tests"}
              </p>
              <ul className="space-y-1.5">
                {selectedOfferings.map((o) => (
                  <li key={o.id} className="flex items-start justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-medium">
                      {lang === "bn" ? o.catalog?.name_bn : o.catalog?.name_en}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatCareMoney(offeringSalePrice(o), lang)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  {lang === "bn" ? "মোট" : "Total"}
                </span>
                <span className="text-sm font-black tabular-nums text-primary">
                  {formatCareMoney(total, lang)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">
                {lang === "bn" ? "টেস্টের তারিখ" : "Test date"}
              </label>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {dates.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDate(d)}
                    className={cn(
                      "shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold",
                      date === d
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card hover:bg-muted/50",
                    )}
                  >
                    {d.slice(5)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {lang === "bn" ? "রোগীর তথ্য" : "Patient details"}
              </p>
              {!profileLoaded ? (
                <div className="h-20 rounded-xl bg-muted/40 animate-pulse" />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {lang === "bn" ? "নাম" : "Name"}
                    </span>
                    <input
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                      autoComplete="name"
                    />
                  </label>
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {lang === "bn" ? "মোবাইল" : "Mobile"}
                    </span>
                    <input
                      value={patientPhone}
                      onChange={(e) => setPatientPhone(clampPhoneDigits(e.target.value))}
                      className="w-full rounded-xl border bg-background px-3 py-2 text-sm tabular-nums"
                      inputMode="tel"
                      maxLength={11}
                      autoComplete="tel"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {lang === "bn" ? "বয়স" : "Age"}
                    </span>
                    <input
                      value={patientAge}
                      onChange={(e) => setPatientAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
                      className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                      inputMode="numeric"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {lang === "bn" ? "লিঙ্গ" : "Sex"}
                    </span>
                    <select
                      value={patientSex}
                      onChange={(e) => setPatientSex(e.target.value)}
                      className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">—</option>
                      <option value="M">{lang === "bn" ? "পুরুষ" : "Male"}</option>
                      <option value="F">{lang === "bn" ? "নারী" : "Female"}</option>
                      <option value="O">{lang === "bn" ? "অন্যান্য" : "Other"}</option>
                    </select>
                  </label>
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {lang === "bn" ? "ঠিকানা" : "Address"}
                    </span>
                    <input
                      value={patientAddress}
                      onChange={(e) => setPatientAddress(e.target.value)}
                      className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {lang === "bn" ? "রেফার্ড বাই" : "Referred by"}
                    </span>
                    <input
                      value={referredBy}
                      onChange={(e) => setReferredBy(e.target.value)}
                      className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          <SheetFooter className="px-4 pb-4 gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={() => setCheckoutOpen(false)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold"
            >
              <X className="h-4 w-4" />
              {lang === "bn" ? "ফিরে যান" : "Back"}
            </button>
            <button
              type="button"
              disabled={busy || !profileLoaded}
              onClick={() => void confirmBook()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-bold disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {lang === "bn" ? "বুক ও ইনভয়েস" : "Book & invoice"}
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
