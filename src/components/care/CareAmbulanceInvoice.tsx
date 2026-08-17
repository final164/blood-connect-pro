import { useCallback, useEffect, useState } from "react";
import { Download, Ambulance, Printer } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { printCareSerialInvoice, downloadCareSerialInvoicePdf } from "@/lib/care-invoice";
import {
  ambulanceInvoiceOrgName,
  ambulanceInvoicePatientName,
  ambulanceInvoicePatientPhone,
  ambulanceInvoiceServiceName,
  fetchAmbulanceInvoice,
  formatCareMoney,
  paymentStatusLabel,
  setAmbulanceInvoicePayment,
  type AmbulanceInvoice,
} from "@/lib/ambulance-invoice";

type Props = {
  requestId: string;
  canManagePayment?: boolean;
  autoPrint?: boolean;
};

export function CareAmbulanceInvoiceCard({ requestId, canManagePayment = false, autoPrint = false }: Props) {
  const { lang } = useI18n();
  const [invoice, setInvoice] = useState<AmbulanceInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [busy, setBusy] = useState(false);
  const printRootId = `care-amb-invoice-${requestId}`;

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const inv = await fetchAmbulanceInvoice(requestId);
      setInvoice(inv);
      if (!inv) setLoadError(lang === "bn" ? "ইনভয়েস পাওয়া যায়নি" : "Invoice not found");
      return inv;
    } catch (e) {
      setLoadError((e as Error).message);
      setInvoice(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [requestId, lang]);

  useEffect(() => {
    void reload().then((inv) => {
      if (autoPrint && inv) setTimeout(() => printCareSerialInvoice(printRootId), 300);
    });
  }, [reload, autoPrint, printRootId]);

  if (loading) {
    return <div className="rounded-2xl border p-6 animate-pulse bg-muted/40 h-32" />;
  }
  if (loadError || !invoice) {
    return (
      <div className="rounded-2xl border border-dashed p-4 text-center space-y-2">
        <p className="text-sm text-muted-foreground">{loadError ?? "—"}</p>
        <button type="button" onClick={() => void reload()} className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold">
          {lang === "bn" ? "আবার" : "Retry"}
        </button>
      </div>
    );
  }

  const org = ambulanceInvoiceOrgName(invoice, lang);
  const patient = ambulanceInvoicePatientName(invoice, lang);
  const phone = ambulanceInvoicePatientPhone(invoice);
  const service = ambulanceInvoiceServiceName(invoice, lang);
  const fare = invoice.final_fare || invoice.estimated_fare;
  const issued = new Date(invoice.created_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 no-print">
        <button type="button" disabled={downloading} onClick={() => void (async () => {
          setDownloading(true);
          try {
            await downloadCareSerialInvoicePdf(printRootId, `${invoice.invoice_no}-ref-${invoice.reference_code}`);
            toast.success(lang === "bn" ? "PDF" : "PDF downloaded");
          } catch (e) { toast.error((e as Error).message); }
          finally { setDownloading(false); }
        })()} className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">
          <Download className="h-4 w-4" /> PDF
        </button>
        <button type="button" onClick={() => printCareSerialInvoice(printRootId)} className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold">
          <Printer className="h-3.5 w-3.5" /> {lang === "bn" ? "প্রিন্ট" : "Print"}
        </button>
        {canManagePayment && invoice.payment_status === "pending" && (
          <button type="button" disabled={busy} onClick={() => void (async () => {
            setBusy(true);
            try { await setAmbulanceInvoicePayment(requestId, "paid"); await reload(); toast.success("OK"); }
            catch (e) { toast.error((e as Error).message); }
            finally { setBusy(false); }
          })()} className="rounded-xl border border-emerald-600 text-emerald-700 px-3 py-2 text-xs font-semibold">
            {lang === "bn" ? "পেমেন্ট" : "Mark paid"}
          </button>
        )}
      </div>
      <article id={printRootId} className="invoice rounded-2xl border bg-card overflow-hidden shadow-sm">
        <header className="head bg-gradient-to-br from-orange-700 to-amber-600 text-white px-4 py-4">
          <div className="flex justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-90 flex items-center gap-1">
                <Ambulance className="h-3 w-3" /> BloodLink · Ambulance
              </p>
              <h1 className="text-lg font-black mt-1">{org}</h1>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase opacity-90">{lang === "bn" ? "ইনভয়েস" : "Invoice"}</p>
              <p className="font-mono text-sm font-bold">{invoice.invoice_no}</p>
            </div>
          </div>
        </header>
        <div className="meta grid grid-cols-2 gap-3 px-4 py-3 bg-orange-50/80 border-b text-xs">
          <div><strong>{lang === "bn" ? "রেফ" : "Ref"}</strong>{invoice.reference_code}</div>
          <div><strong>{lang === "bn" ? "মোড" : "Mode"}</strong>{invoice.mode}</div>
          <div><strong>{lang === "bn" ? "ইস্যু" : "Issued"}</strong>{issued}</div>
          <div><strong>{lang === "bn" ? "পেমেন্ট" : "Payment"}</strong>{paymentStatusLabel(invoice.payment_status, lang)}</div>
        </div>
        <section className="px-4 py-3 border-b space-y-1 text-sm">
          <div className="flex justify-between"><span>{lang === "bn" ? "রোগী" : "Patient"}</span><span className="font-semibold">{patient}</span></div>
          <div className="flex justify-between"><span>{lang === "bn" ? "ফোন" : "Phone"}</span><span className="font-mono">{phone}</span></div>
          <div className="flex justify-between"><span>{lang === "bn" ? "সার্ভিস" : "Service"}</span><span>{service}</span></div>
          {invoice.pickup_address && <div className="text-xs text-muted-foreground mt-2">Pickup: {invoice.pickup_address}</div>}
          {invoice.dropoff_address && <div className="text-xs text-muted-foreground">Dropoff: {invoice.dropoff_address}</div>}
          {invoice.plate_no && <div className="text-xs">Vehicle: {invoice.plate_no}</div>}
        </section>
        <section className="px-4 py-3">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-t">
                <td className="py-3">{lang === "bn" ? "অ্যাম্বুলেন্স ফি" : "Ambulance fee"}</td>
                <td className="py-3 text-right font-black tabular-nums">{formatCareMoney(fare, lang)}</td>
              </tr>
            </tbody>
          </table>
        </section>
        <footer className="foot px-4 py-3 text-[11px] text-muted-foreground bg-muted/30">
          {lang === "bn" ? "BloodLink Care অ্যাম্বুলেন্স সার্ভিস ইনভয়েস।" : "BloodLink Care ambulance service invoice."}
        </footer>
      </article>
    </div>
  );
}
