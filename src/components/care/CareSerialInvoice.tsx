import { useCallback, useEffect, useState } from "react";
import { Download, Printer, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import {
  fetchCareSerialInvoice,
  formatCareMoney,
  invoiceDoctorName,
  invoiceLocationLine,
  invoiceOrgName,
  invoicePatientName,
  invoicePatientPhone,
  invoiceScheduleLine,
  isInvoiceAwaitingSerial,
  paymentStatusLabel,
  printCareSerialInvoice,
  downloadCareSerialInvoicePdf,
  setSerialPaymentStatus,
  type CareSerialInvoice,
} from "@/lib/care-invoice";

type CareSerialInvoiceCardProps = {
  serialId: string;
  /** Desk staff can mark payment */
  canManagePayment?: boolean;
  compact?: boolean;
  autoPrint?: boolean;
  onLoaded?: (invoice: CareSerialInvoice) => void;
};

export function CareSerialInvoiceCard({
  serialId,
  canManagePayment = false,
  compact = false,
  autoPrint = false,
  onLoaded,
}: CareSerialInvoiceCardProps) {
  const { lang } = useI18n();
  const [invoice, setInvoice] = useState<CareSerialInvoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const printRootId = `care-invoice-${serialId}`;

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const inv = await fetchCareSerialInvoice(serialId);
      setInvoice(inv);
      if (inv) onLoaded?.(inv);
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
  }, [serialId, onLoaded, lang]);

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
      const serialPart =
        invoice.serial_no != null ? `serial-${invoice.serial_no}` : "pending";
      await downloadCareSerialInvoicePdf(printRootId, `${invoice.invoice_no}-${serialPart}`);
      toast.success(lang === "bn" ? "PDF ডাউনলোড হয়েছে" : "PDF downloaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  async function markPaid(status: CareSerialInvoice["payment_status"]) {
    setBusy(true);
    try {
      await setSerialPaymentStatus(serialId, status);
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

  const org = invoiceOrgName(invoice, lang);
  const doctor = invoiceDoctorName(invoice, lang);
  const patient = invoicePatientName(invoice, lang);
  const phone = invoicePatientPhone(invoice);
  const location = invoiceLocationLine(invoice, lang);
  const specialty = lang === "bn" ? invoice.specialty_bn || invoice.specialty_en : invoice.specialty_en || invoice.specialty_bn;
  const awaitingSerial = isInvoiceAwaitingSerial(invoice);
  const issued = new Date(invoice.created_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
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
        {canManagePayment && !awaitingSerial && invoice.payment_status === "pending" && (
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
        <header className="head bg-gradient-to-br from-red-700 to-red-600 text-white px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-90 flex items-center gap-1">
                <Receipt className="h-3 w-3" />
                BloodLink Care
              </p>
              <h1 className="text-lg sm:text-xl font-black mt-1">{org}</h1>
              {location && <p className="text-xs opacity-90 mt-1 max-w-md">{location}</p>}
              {(invoice.org_phone || invoice.location_phone) && (
                <p className="text-xs opacity-90 mt-0.5">
                  {invoice.location_phone || invoice.org_phone}
                </p>
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

        <div className="meta grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 py-3 bg-red-50/80 border-b text-xs">
          <div>
            <strong>{lang === "bn" ? "তারিখ" : "Date"}</strong>
            {invoice.session_date}
          </div>
          <div>
            <strong>{lang === "bn" ? "সময়" : "Time"}</strong>
            {invoiceScheduleLine(invoice)}
          </div>
          <div>
            <strong>{lang === "bn" ? "ইস্যু" : "Issued"}</strong>
            {issued}
          </div>
          <div>
            <strong>{lang === "bn" ? "পেমেন্ট" : "Payment"}</strong>
            <span className={`badge inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${invoice.payment_status === "paid" ? "paid bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {paymentStatusLabel(invoice.payment_status, lang)}
            </span>
          </div>
        </div>

        <div className="serial-box text-center py-5 border-b bg-white">
          {awaitingSerial ? (
            <>
              <p className="text-[10px] uppercase tracking-widest text-sky-700/80">
                {lang === "bn" ? "অনলাইন সিরিয়াল" : "Online serial"}
              </p>
              <p className="serial-num text-5xl sm:text-6xl font-black tabular-nums text-sky-800 leading-none mt-2">
                {invoice.online_serial_no ?? "—"}
              </p>
              <div className="mt-3 mx-auto max-w-xs rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2">
                <p className="text-[10px] uppercase tracking-widest text-amber-700/80">
                  {lang === "bn" ? "চেম্বার সিরিয়াল নম্বর" : "Chamber serial no."}
                </p>
                <p className="text-2xl font-black text-amber-600 leading-none mt-1">
                  {lang === "bn" ? "পেন্ডিং" : "PENDING"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                  {lang === "bn"
                    ? "চেম্বার অ্যাপ্রুভ করে serial_no দিলে এখানে দেখা যাবে।"
                    : "Appears here after the chamber approves with a serial number."}
                </p>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground mt-2">{invoice.claim_code}</p>
            </>
          ) : (
            <>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {lang === "bn" ? "চেম্বার সিরিয়াল নম্বর" : "Chamber serial number"}
              </p>
              <p className="serial-num text-5xl sm:text-6xl font-black tabular-nums text-red-700 leading-none mt-1">
                {invoice.serial_no}
              </p>
              {invoice.source === "app" && invoice.online_serial_no != null && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-sky-800">
                    {lang === "bn" ? "অনলাইন সিরিয়াল" : "Online serial"}:
                  </span>{" "}
                  <span className="tabular-nums font-bold">{invoice.online_serial_no}</span>
                </p>
              )}
              <p className="font-mono text-xs text-muted-foreground mt-1">{invoice.claim_code}</p>
            </>
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
            <span>{invoice.source === "walk_in" ? (lang === "bn" ? "ওয়াক-ইন" : "Walk-in") : (lang === "bn" ? "অ্যাপ" : "App")}</span>
          </div>
          <div className="row flex justify-between text-sm">
            <span>{lang === "bn" ? "স্ট্যাটাস" : "Status"}</span>
            <span className="font-semibold">
              {awaitingSerial
                ? lang === "bn"
                  ? "অনুমোদন বাকি"
                  : "Pending approval"
                : invoice.status}
            </span>
          </div>
        </section>

        <section className="px-4 py-3 sm:px-6 border-b space-y-1">
          <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            {lang === "bn" ? "পরামর্শ" : "Consultation"}
          </h2>
          <div className="row flex justify-between text-sm gap-3">
            <span>{lang === "bn" ? "ডাক্তার" : "Doctor"}</span>
            <span className="font-semibold text-right">{doctor}</span>
          </div>
          {specialty && (
            <div className="row flex justify-between text-sm">
              <span>{lang === "bn" ? "বিশেষত্ব" : "Specialty"}</span>
              <span>{specialty}</span>
            </div>
          )}
          {invoice.doctor_bmdc && (
            <div className="row flex justify-between text-sm">
              <span>BMDC</span>
              <span>{invoice.doctor_bmdc}</span>
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
              <tr className="border-t">
                <td className="py-3">
                  {lang === "bn" ? "ডাক্তার পরামর্শ ফি (সিরিয়াল)" : "Doctor consultation fee (serial)"}
                </td>
                <td className="py-3 text-right font-medium tabular-nums">
                  {formatCareMoney(invoice.fee_amount, lang)}
                </td>
              </tr>
              <tr className="border-t">
                <td className="py-3 total font-bold">{lang === "bn" ? "মোট" : "Total"}</td>
                <td className="py-3 text-right total font-black tabular-nums text-base">
                  {formatCareMoney(invoice.fee_amount, lang)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <footer className="foot px-4 py-3 sm:px-6 text-[11px] text-muted-foreground leading-relaxed bg-muted/30">
          {awaitingSerial
            ? lang === "bn"
              ? "এই ইনভয়েস অনুরোধ হিসেবে তৈরি হয়েছে। চেম্বার অনুমোদন ও সিরিয়াল নম্বর দেওয়ার আগে এটি পেন্ডিং থাকবে।"
              : "This invoice was created as a booking request. It stays pending until the chamber approves and assigns a serial number."
            : lang === "bn"
              ? "এই ইনভয়েস BloodLink Care প্ল্যাটফর্মে সিরিয়াল নিশ্চিত হওয়ার সাথে সাথে তৈরি হয়েছে। চেম্বারে উপস্থিত হয়ে সিরিয়াল নম্বর দেখান।"
              : "This invoice was generated when your serial was confirmed on BloodLink Care. Present this serial number at the chamber."}
        </footer>
      </article>
    </div>
  );
}
