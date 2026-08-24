import { useCallback, useEffect, useState } from "react";
import { Download, FlaskConical, Printer, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import {
  formatCareMoney,
  paymentStatusLabel,
  printCareSerialInvoice,
  downloadCareSerialInvoicePdf,
} from "@/lib/care-invoice";
import {
  fetchCareLabInvoice,
  labInvoiceLineName,
  labInvoiceLocationLine,
  labInvoiceOrgName,
  labInvoicePatientName,
  labInvoicePatientPhone,
  labInvoiceSlotLine,
  labInvoiceTestName,
  setLabPaymentStatus,
  type CareLabInvoice,
} from "@/lib/care-lab-invoice";

type CareLabInvoiceCardProps = {
  bookingId: string;
  canManagePayment?: boolean;
  autoPrint?: boolean;
};

export function CareLabInvoiceCard({ bookingId, canManagePayment = false, autoPrint = false }: CareLabInvoiceCardProps) {
  const { lang } = useI18n();
  const [invoice, setInvoice] = useState<CareLabInvoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const printRootId = `care-lab-invoice-${bookingId}`;

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const inv = await fetchCareLabInvoice(bookingId);
      setInvoice(inv);
      if (!inv) setLoadError(lang === "bn" ? "ইনভয়েস পাওয়া যায়নি" : "Invoice not found");
      return inv;
    } catch (e) {
      const message = (e as Error).message;
      setLoadError(message);
      setInvoice(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [bookingId, lang]);

  useEffect(() => {
    void reload().then((inv) => {
      if (autoPrint && inv) {
        setTimeout(() => printCareSerialInvoice(printRootId), 300);
      }
    });
  }, [reload, autoPrint, printRootId]);

  async function downloadPdf() {
    if (!invoice) return;
    setDownloading(true);
    try {
      await downloadCareSerialInvoicePdf(printRootId, `${invoice.invoice_no}-ref-${invoice.reference_code}`);
      toast.success(lang === "bn" ? "PDF ডাউনলোড হয়েছে" : "PDF downloaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  async function markPaid(status: CareLabInvoice["payment_status"]) {
    setBusy(true);
    try {
      await setLabPaymentStatus(bookingId, status);
      toast.success(lang === "bn" ? "আপডেট হয়েছে" : "Updated");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card p-6 space-y-3 animate-pulse" aria-busy>
        <div className="h-10 rounded-xl bg-muted" />
        <div className="h-24 rounded-xl bg-muted" />
        <div className="h-16 rounded-xl bg-muted" />
      </div>
    );
  }

  if (loadError || !invoice) {
    return (
      <div className="rounded-2xl border border-dashed bg-card p-4 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          {loadError ?? (lang === "bn" ? "ইনভয়েস লোড হয়নি" : "Could not load invoice")}
        </p>
        <button
          type="button"
          onClick={() => void reload()}
          className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold"
        >
          {lang === "bn" ? "আবার চেষ্টা" : "Retry"}
        </button>
      </div>
    );
  }

  const org = labInvoiceOrgName(invoice, lang);
  const testName = labInvoiceTestName(invoice, lang);
  const patient = labInvoicePatientName(invoice, lang);
  const phone = labInvoicePatientPhone(invoice);
  const location = labInvoiceLocationLine(invoice, lang);
  const issued = new Date(invoice.created_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 no-print">
        <button
          type="button"
          disabled={downloading}
          onClick={() => void downloadPdf()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          {downloading
            ? lang === "bn"
              ? "PDF তৈরি হচ্ছে…"
              : "Generating PDF…"
            : lang === "bn"
              ? "PDF ডাউনলোড"
              : "Download PDF"}
        </button>
        <button
          type="button"
          onClick={() => printCareSerialInvoice(printRootId)}
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"
        >
          <Printer className="h-3.5 w-3.5" />
          {lang === "bn" ? "প্রিন্ট" : "Print"}
        </button>
        {canManagePayment && invoice.payment_status === "pending" && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void markPaid("paid")}
              className="rounded-xl border border-emerald-600 text-emerald-700 px-3 py-2 text-xs font-semibold"
            >
              {lang === "bn" ? "পেমেন্ট নিশ্চিত" : "Mark paid"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void markPaid("waived")}
              className="rounded-xl border px-3 py-2 text-xs font-semibold text-muted-foreground"
            >
              {lang === "bn" ? "মওকুফ" : "Waive"}
            </button>
          </>
        )}
      </div>

      <article id={printRootId} className="invoice rounded-2xl border bg-card overflow-hidden shadow-sm">
        <header className="head bg-gradient-to-br from-teal-700 to-cyan-600 text-white px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-90 flex items-center gap-1">
                <FlaskConical className="h-3 w-3" />
                BloodLink Care · Lab
              </p>
              <h1 className="text-lg sm:text-xl font-black mt-1">{org}</h1>
              {location && <p className="text-xs opacity-90 mt-1 max-w-md">{location}</p>}
              {(invoice.org_phone || invoice.location_phone) && (
                <p className="text-xs opacity-90 mt-0.5">{invoice.location_phone || invoice.org_phone}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] uppercase tracking-wide opacity-90">
                {lang === "bn" ? "ইনভয়েস" : "Invoice"}
              </p>
              <p className="font-mono text-sm font-bold">{invoice.invoice_no}</p>
            </div>
          </div>
        </header>

        <div className="meta grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 py-3 bg-teal-50/80 border-b text-xs">
          <div>
            <strong>{lang === "bn" ? "টেস্ট তারিখ" : "Test date"}</strong>
            {invoice.test_date || "—"}
          </div>
          <div>
            <strong>{lang === "bn" ? "সময়" : "Time"}</strong>
            {labInvoiceSlotLine(invoice)}
          </div>
          <div>
            <strong>{lang === "bn" ? "ইস্যু" : "Issued"}</strong>
            {issued}
          </div>
          <div>
            <strong>{lang === "bn" ? "পেমেন্ট" : "Payment"}</strong>
            <span
              className={`badge inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${invoice.payment_status === "paid" ? "paid bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
            >
              {paymentStatusLabel(invoice.payment_status, lang)}
            </span>
          </div>
        </div>

        <div className="serial-box text-center py-5 border-b bg-white">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {invoice.line_count > 1
              ? lang === "bn"
                ? "ইনভয়েস / বান্ডেল"
                : "Invoice / bundle"
              : lang === "bn"
                ? "রেফারেন্স কোড"
                : "Reference code"}
          </p>
          <p className="serial-num text-3xl sm:text-4xl font-black tracking-widest text-teal-700 leading-none mt-1">
            {invoice.line_count > 1 ? invoice.invoice_no.replace(/^BLT-/, "") : invoice.reference_code}
          </p>
          {invoice.line_count > 1 ? (
            <p className="text-xs text-muted-foreground mt-2">
              {lang === "bn" ? `${invoice.line_count}টি টেস্ট · এক ইনভয়েস` : `${invoice.line_count} tests · one invoice`}
            </p>
          ) : (
            invoice.test_code && (
              <p className="font-mono text-xs text-muted-foreground mt-2">{invoice.test_code}</p>
            )
          )}
        </div>

        <section className="px-4 py-3 sm:px-6 border-b space-y-1">
          <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            {lang === "bn" ? "রোগী" : "Patient"}
          </h2>
          <div className="row flex justify-between text-sm">
            <span>{lang === "bn" ? "নাম" : "Name"}</span>
            <span className="font-semibold">{patient}</span>
          </div>
          <div className="row flex justify-between text-sm">
            <span>{lang === "bn" ? "মোবাইল" : "Phone"}</span>
            <span className="font-mono">{phone}</span>
          </div>
          <div className="row flex justify-between text-sm">
            <span>{lang === "bn" ? "উৎস" : "Source"}</span>
            <span>
              {invoice.source === "walk_in"
                ? lang === "bn"
                  ? "ওয়াক-ইন"
                  : "Walk-in"
                : lang === "bn"
                  ? "অ্যাপ"
                  : "App"}
            </span>
          </div>
        </section>

        <section className="px-4 py-3 sm:px-6 border-b space-y-1">
          <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            {lang === "bn" ? "ল্যাব টেস্ট" : "Lab test"}
          </h2>
          <div className="row flex justify-between text-sm gap-3">
            <span>{lang === "bn" ? "সারাংশ" : "Summary"}</span>
            <span className="font-semibold text-right">{testName}</span>
          </div>
          {invoice.home_collection && (
            <div className="row flex justify-between text-sm">
              <span>{lang === "bn" ? "হোম কালেকশন" : "Home collection"}</span>
              <span>{lang === "bn" ? "হ্যাঁ" : "Yes"}</span>
            </div>
          )}
        </section>

        <section className="px-4 py-3 sm:px-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase text-muted-foreground">
                <th className="text-left pb-2">{lang === "bn" ? "বিবরণ" : "Description"}</th>
                <th className="text-right pb-2">{lang === "bn" ? "পরিমাণ" : "Amount"}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.booking_id} className="border-t align-top">
                  <td className="py-3 pr-2">
                    <p className="font-medium leading-snug">{labInvoiceLineName(line, lang)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                      {[line.test_code, line.reference_code, line.test_date].filter(Boolean).join(" · ")}
                    </p>
                    {line.discount_percent != null && line.discount_percent > 0 ? (
                      <span className="inline-block mt-1 text-[10px] font-bold text-rose-600">
                        −{line.discount_percent}%
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 text-right font-medium tabular-nums whitespace-nowrap">
                    {line.price_original != null && line.price_original > line.price ? (
                      <span className="block space-y-0.5">
                        <span className="block text-xs text-muted-foreground line-through">
                          {formatCareMoney(line.price_original, lang)}
                        </span>
                        <span className="block font-bold text-emerald-700 dark:text-emerald-400">
                          {formatCareMoney(line.price, lang)}
                        </span>
                      </span>
                    ) : (
                      formatCareMoney(line.price, lang)
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-t">
                <td className="py-3 total font-bold">{lang === "bn" ? "মোট" : "Total"}</td>
                <td className="py-3 text-right total font-black tabular-nums text-base">
                  {invoice.price_original != null && invoice.price_original > invoice.price ? (
                    <span className="block space-y-0.5">
                      <span className="block text-xs text-muted-foreground line-through font-semibold">
                        {formatCareMoney(invoice.price_original, lang)}
                      </span>
                      <span>{formatCareMoney(invoice.price, lang)}</span>
                    </span>
                  ) : (
                    formatCareMoney(invoice.price, lang)
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <footer className="foot px-4 py-3 sm:px-6 text-[11px] text-muted-foreground leading-relaxed bg-muted/30">
          {lang === "bn"
            ? invoice.line_count > 1
              ? "এই ইনভয়েসে একাধিক টেস্ট একসাথে বুক হয়েছে। ল্যাবে উপস্থিত হয়ে ইনভয়েস নম্বর বা যেকোনো রেফারেন্স কোড দেখান।"
              : "এই ইনভয়েস BloodLink Care-এ টেস্ট বুকিং নিশ্চিত হওয়ার সাথে সাথে তৈরি হয়েছে। ল্যাবে উপস্থিত হয়ে রেফারেন্স কোড দেখান।"
            : invoice.line_count > 1
              ? "Multiple tests were booked on this single invoice. Present the invoice number or any reference code at the lab."
              : "This invoice was generated when your lab test was booked on BloodLink Care. Present this reference code at the lab."}
        </footer>
      </article>
    </div>
  );
}
