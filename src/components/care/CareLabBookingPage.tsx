import { useCallback, useEffect, useMemo, useState } from "react";
import { FlaskConical, Receipt } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useI18n } from "@/lib/i18n";
import { fetchLabBookingsForInvoice, setLabBookingStatus, type CareLabBooking } from "@/lib/care-lab-api";
import { CareLabInvoiceCard } from "@/components/care/CareLabInvoice";
import { CareOrgChatButton } from "@/components/care/CareOrgChatButton";
import { CareLabScheduleCard } from "@/components/care/CareLabScheduleCard";
import {
  CareLabProgressBar,
  labStatusLabel,
  labStatusTone,
} from "@/components/care/CareLabProgress";
import { CareLabReportBlock } from "@/components/care/CareLabReportBlock";
import { formatCareMoney } from "@/lib/care-invoice";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type LabBookingRow = CareLabBooking & {
  offering?: { name_bn?: string | null; name_en?: string | null } | null;
};

export function CareLabBookingPage({ bookingId }: { bookingId: string }) {
  const { lang } = useI18n();
  const [rows, setRows] = useState<LabBookingRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [org, setOrg] = useState<{ name: string; name_bn: string | null } | null>(null);

  const reload = useCallback(async () => {
    setRows(await fetchLabBookingsForInvoice(bookingId));
  }, [bookingId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const primary = useMemo(
    () => rows.find((r) => r.id === bookingId) ?? rows[0] ?? null,
    [rows, bookingId],
  );

  useEffect(() => {
    if (!primary?.org_id) {
      setOrg(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("care_orgs")
        .select("name, name_bn")
        .eq("id", primary.org_id)
        .maybeSingle();
      if (!cancelled) {
        setOrg(
          data
            ? { name: String(data.name ?? ""), name_bn: (data.name_bn as string | null) ?? null }
            : null,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [primary?.org_id]);

  const total = useMemo(() => rows.reduce((n, r) => n + Number(r.price ?? 0), 0), [rows]);
  const canCancel = rows.some((r) => ["reserved", "confirmed"].includes(r.status));

  async function cancel() {
    if (!rows.length) return;
    setBusy(true);
    try {
      const targets = rows.filter((r) => ["reserved", "confirmed"].includes(r.status));
      for (const r of targets) {
        await setLabBookingStatus(r.id, "cancelled");
      }
      toast.success(
        lang === "bn"
          ? targets.length > 1
            ? "সব টেস্ট বাতিল হয়েছে"
            : "বাতিল হয়েছে"
          : targets.length > 1
            ? "All tests cancelled"
            : "Cancelled",
      );
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <AutoHideHeader className="z-30 border-b bg-background safe-top">
        <div className="flex items-center gap-2 px-3 py-2">
          <PageBackButton
            fallbackTo={{ to: "/care", search: { tab: "bookings" } }}
            shape="xl"
          />
          <h1 className="text-sm font-bold flex-1 truncate">
            {rows.length > 1
              ? lang === "bn"
                ? "মাল্টি-টেস্ট ইনভয়েস"
                : "Multi-test invoice"
              : lang === "bn"
                ? "টেস্ট বুকিং"
                : "Test booking"}
          </h1>
          {primary?.org_id ? (
            <CareOrgChatButton orgId={primary.org_id} variant="icon" />
          ) : null}
        </div>
      </AutoHideHeader>
      <div className="px-3 py-6 max-w-lg mx-auto space-y-6">
        {!primary ? (
          <p className="text-sm text-muted-foreground text-center">
            {lang === "bn" ? "লোড হচ্ছে…" : "Loading…"}
          </p>
        ) : (
          <>
            <div className="text-center space-y-3 max-w-md mx-auto">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {rows.length > 1
                  ? lang === "bn"
                    ? "ইনভয়েস"
                    : "Invoice"
                  : lang === "bn"
                    ? "রেফারেন্স"
                    : "Reference"}
              </p>
              <p className="text-3xl font-black tracking-widest text-primary">
                {rows.length > 1
                  ? (primary.invoice_no || primary.reference_code).replace(/^BLT-/, "")
                  : primary.reference_code}
              </p>
              {primary.invoice_no && (
                <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1 justify-center">
                  <Receipt className="h-3 w-3" />
                  {primary.invoice_no}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {rows.length > 1
                  ? lang === "bn"
                    ? `${rows.length}টি টেস্ট · ${formatCareMoney(total, lang)}`
                    : `${rows.length} tests · ${formatCareMoney(total, lang)}`
                  : formatCareMoney(Number(primary.price ?? 0), lang)}
              </p>
              {canCancel && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void cancel()}
                  className="text-xs font-semibold text-destructive"
                >
                  {rows.length > 1
                    ? lang === "bn"
                      ? "সব বাতিল"
                      : "Cancel all"
                    : lang === "bn"
                      ? "বাতিল"
                      : "Cancel"}
                </button>
              )}
            </div>

            <CareLabScheduleCard
              bookings={rows}
              orgName={org?.name}
              orgNameBn={org?.name_bn}
              lang={lang}
            />

            <section className="rounded-2xl border bg-card p-4 space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
                  {lang === "bn" ? "টেস্টের অগ্রগতি" : "Test progress"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {lang === "bn"
                    ? "ল্যাব চেক-ইন → নমুনা → সম্পন্ন ধাপগুলো এখানে দেখবেন।"
                    : "Follow check-in → sample → completed steps here."}
                </p>
              </div>

              {rows.length <= 1 ? (
                <div className="space-y-3">
                  <CareLabProgressBar status={primary.status} lang={lang} schedule={primary} />
                  <CareLabReportBlock booking={primary} lang={lang} canEdit={false} />
                </div>
              ) : (
                <ul className="space-y-3">
                  {rows.map((r) => {
                    const withOff = r as CareLabBooking & {
                      offering?: { name_bn?: string; name_en?: string } | null;
                      care_test_offerings?: {
                        care_test_catalog?: { name_bn?: string; name_en?: string };
                      } | null;
                    };
                    const cat = withOff.offering ?? withOff.care_test_offerings?.care_test_catalog;
                    const name =
                      (lang === "bn" ? cat?.name_bn : cat?.name_en) || r.reference_code;
                    return (
                      <li key={r.id} className="rounded-xl border px-3 py-3 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex items-start gap-2">
                            <span className="mt-0.5 h-8 w-8 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                              <FlaskConical className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{name}</p>
                              <p className="text-[10px] font-mono text-muted-foreground">
                                {r.reference_code}
                              </p>
                            </div>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                              labStatusTone(r.status),
                            )}
                          >
                            {labStatusLabel(r.status, lang)}
                          </span>
                        </div>
                        <CareLabProgressBar status={r.status} lang={lang} schedule={r} />
                        <CareLabReportBlock booking={r} lang={lang} canEdit={false} compact />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                <Receipt className="h-3.5 w-3.5" />
                {lang === "bn" ? "ইনভয়েস" : "Invoice"}
              </p>
              <CareLabInvoiceCard bookingId={bookingId} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
