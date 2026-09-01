import { useCallback, useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { printCareSerialInvoice, downloadCareSerialInvoicePdf } from "@/lib/care-invoice";
import { fetchCareLabInvoice, setLabPaymentStatus, type CareLabInvoice } from "@/lib/care-lab-invoice";
import { resolveCareInvoiceTemplate, type ResolvedCareInvoiceTemplate } from "@/lib/care-invoice-settings";
import { mapLabInvoiceToViewModel } from "@/lib/care-invoice-view-model";
import { CareCashMemoInvoice } from "@/components/care/CareCashMemoInvoice";

type CareLabInvoiceCardProps = {
  bookingId: string;
  canManagePayment?: boolean;
  autoPrint?: boolean;
};

export function CareLabInvoiceCard({ bookingId, canManagePayment = false, autoPrint = false }: CareLabInvoiceCardProps) {
  const { lang } = useI18n();
  const [invoice, setInvoice] = useState<CareLabInvoice | null>(null);
  const [template, setTemplate] = useState<ResolvedCareInvoiceTemplate | null>(null);
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
      if (!inv) {
        setLoadError(lang === "bn" ? "ইনভয়েস পাওয়া যায়নি" : "Invoice not found");
        setTemplate(null);
        return null;
      }
      const tpl = await resolveCareInvoiceTemplate(inv.org_id, {
        name: inv.org_name,
        name_bn: inv.org_name_bn,
        phone: inv.org_phone,
        address: inv.org_address,
      });
      setTemplate(tpl);
      return inv;
    } catch (e) {
      setLoadError((e as Error).message);
      setInvoice(null);
      setTemplate(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [bookingId, lang]);

  useEffect(() => {
    void reload().then((inv) => {
      if (autoPrint && inv) setTimeout(() => printCareSerialInvoice(printRootId), 400);
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
      </div>
    );
  }

  if (loadError || !invoice || !template) {
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

  const vm = mapLabInvoiceToViewModel(invoice, template, lang);

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
          <button
            type="button"
            disabled={busy}
            onClick={() => void markPaid("paid")}
            className="rounded-xl border border-emerald-600 text-emerald-700 px-3 py-2 text-xs font-semibold"
          >
            {lang === "bn" ? "পেমেন্ট নিশ্চিত" : "Mark paid"}
          </button>
        )}
      </div>

      <div id={printRootId} className="rounded-sm overflow-hidden bg-white shadow-sm">
        <CareCashMemoInvoice vm={vm} template={template} lang={lang} />
      </div>
    </div>
  );
}
