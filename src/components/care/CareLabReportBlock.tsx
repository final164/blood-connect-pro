import { useRef, useState } from "react";
import { Download, Eye, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { getLabReportDownloadUrl, type CareLabBooking } from "@/lib/care-lab-api";
import { removeLabReportPdf, uploadLabReportPdf } from "@/lib/care-lab-report";
import { cn } from "@/lib/utils";

type ReportSource = Pick<
  CareLabBooking,
  | "id"
  | "org_id"
  | "invoice_group_id"
  | "status"
  | "report_url"
  | "report_path"
  | "report_file_name"
  | "report_uploaded_at"
>;

export function hasLabReport(row: Pick<ReportSource, "report_path" | "report_url">) {
  return !!(row.report_path || row.report_url);
}

export function CareLabReportBlock({
  booking,
  lang,
  canEdit,
  onChanged,
}: {
  booking: ReportSource;
  lang: "bn" | "en";
  canEdit?: boolean;
  onChanged?: () => void;
}) {
  const bn = lang === "bn";
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const hasReport = hasLabReport(booking);
  const completed = booking.status === "completed";

  async function openUrl(mode: "view" | "download") {
    if (!booking.report_path && !booking.report_url) return;
    setBusy(true);
    try {
      const url = booking.report_path
        ? await getLabReportDownloadUrl(booking.report_path)
        : String(booking.report_url);
      if (mode === "view") {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = booking.report_file_name || "lab-report.pdf";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | null | undefined) {
    if (!file || !canEdit) return;
    setBusy(true);
    try {
      await uploadLabReportPdf({
        orgId: booking.org_id,
        bookingId: booking.id,
        groupKey: booking.invoice_group_id || booking.id,
        file,
        previousPath: booking.report_path,
        applyGroup: true,
      });
      toast.success(bn ? "রিপোর্ট আপলোড হয়েছে" : "Report uploaded");
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function clear() {
    if (!canEdit || !hasReport) return;
    if (
      !window.confirm(
        bn ? "রিপোর্ট মুছে ফেলবেন?" : "Remove the uploaded report?",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await removeLabReportPdf({
        bookingId: booking.id,
        path: booking.report_path,
        applyGroup: true,
      });
      toast.success(bn ? "রিপোর্ট মুছেছে" : "Report removed");
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit && !hasReport) return null;

  return (
    <div className="rounded-2xl border bg-card p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {bn ? "ল্যাব রিপোর্ট" : "Lab report"}
        </p>
      </div>

      {hasReport ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold truncate">
            {booking.report_file_name || (bn ? "রিপোর্ট.pdf" : "report.pdf")}
          </p>
          {booking.report_uploaded_at ? (
            <p className="text-[10px] text-muted-foreground tabular-nums">
              {bn ? "আপলোড" : "Uploaded"} ·{" "}
              {new Date(booking.report_uploaded_at).toLocaleString(
                bn ? "bn-BD" : "en-GB",
                { dateStyle: "medium", timeStyle: "short" },
              )}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void openUrl("view")}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold",
                "hover:bg-muted transition disabled:opacity-50",
              )}
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
              {bn ? "দেখুন" : "View"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void openUrl("download")}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-1.5 text-[11px] font-bold text-primary",
                "hover:bg-primary hover:text-primary-foreground transition disabled:opacity-50",
              )}
            >
              <Download className="h-3 w-3" />
              {bn ? "ডাউনলোড" : "Download"}
            </button>
            {canEdit && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold hover:bg-muted transition disabled:opacity-50"
                >
                  <Upload className="h-3 w-3" />
                  {bn ? "বদলান" : "Replace"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void clear()}
                  className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-2.5 py-1.5 text-[11px] font-bold text-destructive hover:bg-destructive/10 transition disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  {bn ? "মুছুন" : "Remove"}
                </button>
              </>
            )}
          </div>
        </div>
      ) : canEdit ? (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            {completed
              ? bn
                ? "সম্পন্ন বুকিংয়ের PDF রিপোর্ট আপলোড করুন।"
                : "Upload the PDF report for this completed booking."
              : bn
                ? "রিপোর্ট আপলোড করতে আগে স্ট্যাটাস সম্পন্ন করুন।"
                : "Mark the booking completed before uploading a report."}
          </p>
          <button
            type="button"
            disabled={busy || !completed}
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-xl border-2 border-primary bg-primary/5 px-4 py-2 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {bn ? "PDF আপলোড" : "Upload PDF"}
          </button>
        </div>
      ) : null}

      {canEdit && (
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      )}
    </div>
  );
}

/** Tiny chip for list cards when a report exists. */
export function CareLabReportChip({
  hasReport,
  lang,
}: {
  hasReport: boolean;
  lang: "bn" | "en";
}) {
  if (!hasReport) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/5 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
      <FileText className="h-3 w-3" />
      {lang === "bn" ? "রিপোর্ট ✓" : "Report ✓"}
    </span>
  );
}
