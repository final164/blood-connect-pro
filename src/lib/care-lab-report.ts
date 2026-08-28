import { clearLabReport, setLabReport, type CareLabBooking } from "@/lib/care-lab-api";
import { supabase } from "@/integrations/supabase/client";

export const LAB_REPORT_BUCKET = "care-lab-reports";
const MAX_BYTES = 15 * 1024 * 1024;

function sanitizeFileName(name: string) {
  const base = name.replace(/[^\w.\-()+ ]+/g, "_").trim() || "report.pdf";
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

/**
 * Upload a PDF report for one lab test booking (private bucket).
 * Path: {org_id}/{booking_id}/{timestamp}-file.pdf — one file per test.
 */
export async function uploadLabReportPdf(opts: {
  orgId: string;
  bookingId: string;
  file: File;
  previousPath?: string | null;
}): Promise<CareLabBooking> {
  const file = opts.file;
  if (!file || file.type !== "application/pdf") {
    throw new Error("Only PDF files are allowed");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("PDF must be 15 MB or smaller");
  }

  const safeName = sanitizeFileName(file.name);
  const path = `${opts.orgId}/${opts.bookingId}/${Date.now()}-${safeName}`;

  const { error: upErr } = await supabase.storage.from(LAB_REPORT_BUCKET).upload(path, file, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upErr) throw new Error(upErr.message);

  try {
    const booking = await setLabReport(opts.bookingId, {
      path,
      fileName: safeName,
      applyGroup: false,
    });

    if (opts.previousPath && opts.previousPath !== path) {
      void supabase.storage.from(LAB_REPORT_BUCKET).remove([opts.previousPath]);
    }

    return booking;
  } catch (e) {
    void supabase.storage.from(LAB_REPORT_BUCKET).remove([path]);
    throw e;
  }
}

export async function removeLabReportPdf(opts: {
  bookingId: string;
  path?: string | null;
}): Promise<CareLabBooking> {
  const booking = await clearLabReport(opts.bookingId, false);
  if (opts.path) {
    const { error } = await supabase.storage.from(LAB_REPORT_BUCKET).remove([opts.path]);
    if (error && !/not found|No such file/i.test(error.message)) {
      throw new Error(error.message);
    }
  }
  return booking;
}
