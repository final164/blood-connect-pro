import { useCallback, useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { printCareSerialInvoice, downloadCareSerialInvoicePdf } from "@/lib/care-invoice";
import {
  fetchAmbulanceInvoice,
  setAmbulanceInvoicePayment,
  type AmbulanceInvoice,
} from "@/lib/ambulance-invoice";
import {
  fetchCareInvoiceSettings,
  resolveCareInvoiceTemplate,
  resolveCareInvoiceTemplateFromParts,
  type ResolvedCareInvoiceTemplate,
} from "@/lib/care-invoice-settings";
import { mapAmbulanceInvoiceToViewModel } from "@/lib/care-invoice-view-model";
import { CareCashMemoInvoice } from "@/components/care/CareCashMemoInvoice";

type Props = {
  requestId: string;
  canManagePayment?: boolean;
  autoPrint?: boolean;
};

export function CareAmbulanceInvoiceCard({ requestId, canManagePayment = false, autoPrint = false }: Props) {
  const { lang } = useI18n();
  const [invoice, setInvoice] = useState<AmbulanceInvoice | null>(null);
  const [template, setTemplate] = useState<ResolvedCareInvoiceTemplate | null>(null);
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
      if (!inv) {
        setLoadError(lang === "bn" ? "ইনভয়েস পাওয়া যায়নি" : "Invoice not found");
        setTemplate(null);
        return null;
      }
      const orgRow = {
        name: inv.org_name,
        name_bn: inv.org_name_bn,
        phone: inv.org_phone,
        address: inv.org_address,
      };
      if (inv.org_id) {
        setTemplate(await resolveCareInvoiceTemplate(inv.org_id, orgRow));
      } else {
        const platform = await fetchCareInvoiceSettings();
        setTemplate(resolveCareInvoiceTemplateFromParts(platform, null, orgRow, false));
      }
      return inv;
    } catch (e) {
      setLoadError((e as Error).message);
      setInvoice(null);
      setTemplate(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [requestId, lang]);

  useEffect(() => {
    void reload().then((inv) => {
      if (autoPrint && inv) setTimeout(() => printCareSerialInvoice(printRootId), 400);
    });
  }, [reload, autoPrint, printRootId]);

  if (loading) {
    return <div className="rounded-2xl border p-6 animate-pulse bg-muted/40 h-32" />;
  }
  if (loadError || !invoice || !template) {
    return (
      <div className="rounded-2xl border border-dashed p-4 text-center space-y-2">
        <p className="text-sm text-muted-foreground">{loadError ?? "—"}</p>
        <button
          type="button"
          onClick={() => void reload()}
          className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold"
        >
          {lang === "bn" ? "আবার" : "Retry"}
        </button>
      </div>
    );
  }

  const vm = mapAmbulanceInvoiceToViewModel(invoice, template, lang);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 no-print">
        <button
          type="button"
          disabled={downloading}
          onClick={() =>
            void (async () => {
              setDownloading(true);
              try {
                await downloadCareSerialInvoicePdf(
                  printRootId,
                  `${invoice.invoice_no}-ref-${invoice.reference_code}`,
                );
                toast.success(lang === "bn" ? "PDF ডাউনলোড হয়েছে" : "PDF downloaded");
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setDownloading(false);
              }
            })()
          }
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold"
        >
          <Download className="h-4 w-4" /> PDF
        </button>
        <button
          type="button"
          onClick={() => printCareSerialInvoice(printRootId)}
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"
        >
          <Printer className="h-3.5 w-3.5" /> {lang === "bn" ? "প্রিন্ট" : "Print"}
        </button>
        {canManagePayment && invoice.payment_status === "pending" && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void (async () => {
                setBusy(true);
                try {
                  await setAmbulanceInvoicePayment(requestId, "paid");
                  await reload();
                  toast.success(lang === "bn" ? "পেমেন্ট নিশ্চিত" : "Marked paid");
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(false);
                }
              })()
            }
            className="rounded-xl border border-emerald-600 text-emerald-700 px-3 py-2 text-xs font-semibold"
          >
            {lang === "bn" ? "পেমেন্ট" : "Mark paid"}
          </button>
        )}
      </div>
      <div id={printRootId} className="rounded-sm overflow-hidden bg-white shadow-sm">
        <CareCashMemoInvoice vm={vm} template={template} lang={lang} />
      </div>
    </div>
  );
}
