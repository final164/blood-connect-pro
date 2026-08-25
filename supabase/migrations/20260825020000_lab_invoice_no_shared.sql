-- Allow shared invoice_no across multi-test bookings (one invoice, many lines).
-- Root cause of: duplicate key value violates unique constraint "care_lab_bookings_invoice_no_idx"

DROP INDEX IF EXISTS public.care_lab_bookings_invoice_no_idx;

CREATE INDEX IF NOT EXISTS care_lab_bookings_invoice_no_lookup_idx
  ON public.care_lab_bookings (invoice_no)
  WHERE invoice_no IS NOT NULL;

COMMENT ON INDEX public.care_lab_bookings_invoice_no_lookup_idx IS
  'Non-unique: multiple bookings may share one invoice_no via invoice_group_id';
