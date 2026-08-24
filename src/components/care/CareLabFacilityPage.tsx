import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Building2, Check, FlaskConical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { formatCareMoney } from "@/lib/care-invoice";
import {
  ensurePatientLabDay,
  fetchLabFacility,
  remainingSeats,
  reserveLabBundle,
  searchTestOfferings,
  type CareLabFacility,
  type CareOffering,
} from "@/lib/care-lab-api";
import { offeringSalePrice } from "@/lib/care-lab-price";
import { CareLabPriceDisplay } from "@/components/care/CareLabPriceDisplay";
import { cn } from "@/lib/utils";

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

export function CareLabFacilityPage({ orgId }: { orgId: string }) {
  const { lang } = useI18n();
  const { session, isAnonymous } = useAuth();
  const navigate = useNavigate();
  const [facility, setFacility] = useState<CareLabFacility | null>(null);
  const [offerings, setOfferings] = useState<CareOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(() => isoDateLocal(new Date()));
  const [busy, setBusy] = useState(false);
  const dates = useMemo(() => nextDates(14), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([fetchLabFacility(orgId), searchTestOfferings({ orgId })])
      .then(([f, list]) => {
        if (cancelled) return;
        setFacility(f);
        setOfferings(list);
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
  }, [orgId]);

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

  async function bookSelected() {
    if (!selectedOfferings.length) {
      toast.error(lang === "bn" ? "কমপক্ষে একটি টেস্ট বেছে নিন" : "Select at least one test");
      return;
    }
    if (!session || isAnonymous) {
      void navigate({
        to: "/auth",
        search: { next: `/care/labs/${orgId}` } as never,
      });
      return;
    }

    setBusy(true);
    try {
      const calendarIds: string[] = [];
      for (const o of selectedOfferings) {
        const cal = await ensurePatientLabDay(o.id, date);
        if (remainingSeats(cal) <= 0) {
          const name = lang === "bn" ? o.catalog?.name_bn : o.catalog?.name_en;
          throw new Error(
            lang === "bn"
              ? `${name ?? "টেস্ট"} — এই তারিখে স্লট পূর্ণ`
              : `${name ?? "Test"} — slot full on this date`,
          );
        }
        calendarIds.push(cal.id);
      }

      const result = await reserveLabBundle({ calendarIds, source: "app" });
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
            fallbackTo={{ to: "/care", search: { tab: "tests" } }}
            shape="xl"
          />
          <h1 className="text-sm font-bold truncate">{title}</h1>
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
              <span className="h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                <Building2 className="h-5 w-5" />
              </span>
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

      {selectedOfferings.length > 0 && (
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
              disabled={busy}
              onClick={() => void bookSelected()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-bold disabled:opacity-60 shrink-0"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {lang === "bn" ? "বুক ও ইনভয়েস" : "Book & invoice"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
