import { useCallback, useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { downloadCareSerialInvoicePdf, printCareSerialInvoice } from "@/lib/care-invoice";
import { resolveCareInvoiceTemplate, type ResolvedCareInvoiceTemplate } from "@/lib/care-invoice-settings";
import { mapOperationInvoiceToViewModel } from "@/lib/care-invoice-view-model";
import {
  fetchCareOperationInvoice,
  type CareOperationInvoice,
} from "@/lib/care-operation-invoice";
import { setOperationPayment } from "@/lib/care-operations-api";
import { CareCashMemoInvoice } from "@/components/care/CareCashMemoInvoice";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function CareOperationInvoiceCard({
  bookingId,
  canManagePayment = false,
  autoPrint = false,
}: {
  bookingId: string;
  canManagePayment?: boolean;
  autoPrint?: boolean;
}) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const [invoice, setInvoice] = useState<CareOperationInvoice | null>(null);
  const [template, setTemplate] = useState<ResolvedCareInvoiceTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const printRootId = `care-operation-invoice-${bookingId}`;

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const inv = await fetchCareOperationInvoice(bookingId);
      setInvoice(inv);
      if (!inv) {
        setLoadError(bn ? "ইনভয়েস পাওয়া যায়নি" : "Invoice not found");
        setTemplate(null);
        return null;
      }
      setTemplate(
        await resolveCareInvoiceTemplate(inv.org_id, {
          name: inv.org_name,
          name_bn: inv.org_name_bn,
          phone: inv.org_phone,
          address: inv.org_address,
        }),
      );
      return inv;
    } catch (e) {
      setLoadError((e as Error).message);
      setInvoice(null);
      setTemplate(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [bookingId, bn]);

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
      toast.success(bn ? "PDF ডাউনলোড হয়েছে" : "PDF downloaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  async function markPayment(status: "paid" | "waived") {
    setBusy(true);
    try {
      await setOperationPayment(bookingId, status, status === "paid" ? invoice?.price ?? null : null);
      toast.success(bn ? "আপডেট হয়েছে" : "Updated");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3 rounded-2xl border bg-card p-6 animate-pulse" aria-busy>
        <div className="h-10 rounded-xl bg-muted" />
        <div className="h-24 rounded-xl bg-muted" />
      </div>
    );
  }

  if (loadError || !invoice || !template) {
    return (
      <div className="space-y-3 rounded-2xl border border-dashed bg-card p-4 text-center">
        <p className="text-sm text-muted-foreground">
          {loadError ?? (bn ? "ইনভয়েস লোড হয়নি" : "Could not load invoice")}
        </p>
        <button
          type="button"
          onClick={() => void reload()}
          className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          {bn ? "আবার চেষ্টা" : "Retry"}
        </button>
      </div>
    );
  }

  const vm = mapOperationInvoiceToViewModel(invoice, template, lang);

  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={downloading}
          onClick={() => void downloadPdf()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          {downloading ? (bn ? "PDF তৈরি হচ্ছে…" : "Generating PDF…") : bn ? "PDF ডাউনলোড" : "Download PDF"}
        </button>
        <button
          type="button"
          onClick={() => printCareSerialInvoice(printRootId)}
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"
        >
          <Printer className="h-3.5 w-3.5" />
          {bn ? "প্রিন্ট" : "Print"}
        </button>
        {canManagePayment && invoice.payment_status === "pending" && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void markPayment("paid")}
              className="rounded-xl border border-emerald-600 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-60"
            >
              {bn ? "পেমেন্ট নিশ্চিত" : "Mark paid"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void markPayment("waived")}
              className="rounded-xl border px-3 py-2 text-xs font-semibold text-muted-foreground disabled:opacity-60"
            >
              {bn ? "মওকুফ" : "Waive"}
            </button>
          </>
        )}
      </div>

      <div id={printRootId} className="overflow-hidden rounded-sm bg-white shadow-sm">
        <CareCashMemoInvoice vm={vm} template={template} lang={lang} />
      </div>
    </div>
  );
}

export function CareOperationInvoiceDialog({
  bookingId,
  open,
  onOpenChange,
  canManagePayment = true,
}: {
  bookingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManagePayment?: boolean;
}) {
  const { lang } = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {lang === "bn" ? "অপারেশন ইনভয়েস" : "Operation invoice"}
          </DialogTitle>
        </DialogHeader>
        <CareOperationInvoiceCard bookingId={bookingId} canManagePayment={canManagePayment} />
      </DialogContent>
    </Dialog>
  );
}
