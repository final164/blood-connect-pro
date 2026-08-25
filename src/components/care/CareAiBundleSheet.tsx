import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { locName } from "@/lib/care-cms";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  bookBundlePlan,
  nextFourteenDates,
  type BundleBookResult,
  type BundlePlan,
} from "@/lib/care-ai-bundle";
import { CareLabPriceDisplay } from "@/components/care/CareLabPriceDisplay";
import { formatCareMoney } from "@/lib/care-invoice";
import { clampPhoneDigits } from "@/lib/phone-auth";
import { cn } from "@/lib/utils";

export function CareAiBundleSheet({
  open,
  onOpenChange,
  plan,
  lang,
  busy,
  setBusy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: BundlePlan | null;
  lang: "bn" | "en";
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const { session, user, isAnonymous } = useAuth();
  const dates = useMemo(() => nextFourteenDates(), []);
  const [date, setDate] = useState(() => nextFourteenDates()[0]);
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!user?.id || isAnonymous) {
      setProfileLoaded(true);
      return;
    }
    let cancelled = false;
    setProfileLoaded(false);
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
  }, [open, user?.id, isAnonymous]);

  async function confirm() {
    if (!plan?.groups.length || busy) return;
    if (!session || isAnonymous) {
      void navigate({ to: "/auth", search: { next: "/care/ai-tests" } as never });
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
      const results: BundleBookResult[] = await bookBundlePlan(plan, {
        date,
        guestName: name,
        guestPhone: phone || undefined,
      });
      const ok = results.filter((r) => r.ok);
      const fail = results.filter((r) => !r.ok);
      if (ok.length) {
        toast.success(
          lang === "bn"
            ? `বুকিং হয়েছে (${ok.length}) — My bookings-এ যান`
            : `Booked ${ok.length} test(s) — open My bookings`,
        );
      }
      if (fail.length) {
        toast.error(
          lang === "bn"
            ? `${fail.length}টি বুক হয়নি: ${fail.map((f) => f.name).join(", ")}`
            : `${fail.length} failed: ${fail.map((f) => f.name).join(", ")}`,
        );
      }
      if (ok.length) {
        onOpenChange(false);
        const primary = ok.find((r) => r.booking?.id)?.booking?.id;
        if (primary) {
          void navigate({ to: "/care/lab-booking/$id", params: { id: primary } });
        } else {
          void navigate({ to: "/care", search: { tab: "bookings" } });
        }
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{lang === "bn" ? "বুকিং ফর্ম" : "Booking form"}</SheetTitle>
          <SheetDescription>
            {lang === "bn"
              ? "তারিখ ও রোগীর তথ্য দিন — তারপর ইনভয়েস তৈরি হবে।"
              : "Enter date and patient details — then invoices will be created."}
          </SheetDescription>
        </SheetHeader>

        {!plan || plan.groups.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            {lang === "bn" ? "এই টেস্টগুলোর অফার পাওয়া যায়নি।" : "No priced offerings found for these tests."}
          </p>
        ) : (
          <div className="space-y-4 py-3">
            {plan.groups.map((g) => (
              <div key={g.orgId} className="rounded-xl border px-3 py-2.5 space-y-1.5">
                <p className="text-sm font-semibold">
                  {locName({ name: g.orgName, name_bn: g.orgNameBn }, lang)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    · {g.items.length} {lang === "bn" ? "টেস্ট" : "tests"}
                  </span>
                </p>
                <ul className="text-sm space-y-1">
                  {g.items.map((item) => (
                    <li key={item.offering.id} className="flex justify-between gap-2">
                      <span className="truncate">
                        {lang === "bn"
                          ? item.offering.catalog?.name_bn || item.offering.catalog?.code
                          : item.offering.catalog?.name_en || item.offering.catalog?.code}
                      </span>
                      <CareLabPriceDisplay
                        listPrice={item.offering.price}
                        discountPercent={item.offering.discount_percent}
                        lang={lang}
                        variant="inline"
                        className="shrink-0 justify-end"
                      />
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-right text-muted-foreground tabular-nums">
                  {lang === "bn" ? "সাবটোটাল" : "Subtotal"} {formatCareMoney(g.subtotal, lang)}
                </p>
              </div>
            ))}
            {plan.uncovered.length > 0 && (
              <p className="text-xs text-amber-700">
                {lang === "bn"
                  ? `${plan.uncovered.length}টি টেস্ট কোনো ক্লিনিকে পাওয়া যায়নি।`
                  : `${plan.uncovered.length} test(s) not offered at listed clinics.`}
              </p>
            )}
            <p className="text-base font-bold text-right tabular-nums">
              {lang === "bn" ? "মোট" : "Total"} {formatCareMoney(plan.total, lang)}
            </p>

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
                <div className="grid gap-2">
                  <label className="space-y-1">
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
                  <label className="space-y-1">
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
                </div>
              )}
            </div>
          </div>
        )}

        <SheetFooter className="gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
          >
            {lang === "bn" ? "ফিরে যান" : "Back"}
          </button>
          <button
            type="button"
            disabled={busy || !plan?.groups.length || !profileLoaded}
            onClick={() => void confirm()}
            className="rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {busy
              ? lang === "bn"
                ? "বুক হচ্ছে…"
                : "Booking…"
              : lang === "bn"
                ? "বুক ও ইনভয়েস"
                : "Book & invoice"}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
