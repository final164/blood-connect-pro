-- Per-test lab discount % on offerings; charge discounted amount on reserve

ALTER TABLE public.care_test_offerings
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'care_test_offerings_discount_percent_check'
  ) THEN
    ALTER TABLE public.care_test_offerings
      ADD CONSTRAINT care_test_offerings_discount_percent_check
      CHECK (discount_percent >= 0 AND discount_percent <= 100);
  END IF;
END $$;

ALTER TABLE public.care_lab_bookings
  ADD COLUMN IF NOT EXISTS price_original NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2);

COMMENT ON COLUMN public.care_test_offerings.discount_percent IS
  'List price stays in price; sale = ROUND(price * (1 - discount_percent/100), 2)';
COMMENT ON COLUMN public.care_lab_bookings.price_original IS
  'List/MRP at booking time when a discount applied';
COMMENT ON COLUMN public.care_lab_bookings.discount_percent IS
  'Discount % applied at booking time';

-- Seed sample discounts on common tests (idempotent: only where still 0)
UPDATE public.care_test_offerings o
SET discount_percent = v.pct
FROM public.care_test_catalog c,
LATERAL (
  SELECT CASE
    WHEN upper(c.code) IN ('CBC', 'CBC-ESR', 'HB') THEN 15::numeric
    WHEN upper(c.code) IN ('LIPID', 'LIPID-P', 'CHOLESTEROL') THEN 20::numeric
    WHEN upper(c.code) IN ('RBS', 'FBS', 'HBA1C', 'PPBS') THEN 12::numeric
    WHEN upper(c.code) IN ('LFT', 'SGPT', 'SGOT', 'BILIRUBIN') THEN 18::numeric
    WHEN upper(c.code) IN ('RFT', 'CREAT', 'UREA', 'BUN') THEN 18::numeric
    WHEN upper(c.code) IN ('TSH', 'T3', 'T4', 'FT4') THEN 22::numeric
    WHEN upper(c.code) IN ('URINE-R/E', 'URINE', 'URE') THEN 10::numeric
    WHEN upper(c.code) IN ('XRAY-CHEST', 'USG-W/A', 'ECG') THEN 25::numeric
    WHEN upper(c.code) LIKE '%COVID%' OR upper(c.code) LIKE '%PCR%' THEN 30::numeric
    WHEN c.name_en ILIKE '%complete blood%' OR c.name_bn ILIKE '%সম্পূর্ণ রক্ত%' THEN 15::numeric
    WHEN c.name_en ILIKE '%lipid%' OR c.name_bn ILIKE '%লিপিড%' THEN 20::numeric
    WHEN c.name_en ILIKE '%thyroid%' OR c.name_bn ILIKE '%থাইরয়েড%' THEN 22::numeric
    WHEN c.name_en ILIKE '%diabetes%' OR c.name_en ILIKE '%glucose%' OR c.name_bn ILIKE '%গ্লুকোজ%' THEN 12::numeric
    WHEN c.name_en ILIKE '%liver%' OR c.name_bn ILIKE '%লিভার%' THEN 18::numeric
    WHEN c.name_en ILIKE '%kidney%' OR c.name_en ILIKE '%renal%' OR c.name_bn ILIKE '%কিডনি%' THEN 18::numeric
    ELSE NULL
  END AS pct
) v
WHERE o.catalog_id = c.id
  AND COALESCE(o.discount_percent, 0) = 0
  AND v.pct IS NOT NULL
  AND o.is_active = true;

-- Also give a light promo to a slice of remaining active offerings still at 0%
WITH ranked AS (
  SELECT o.id,
    ROW_NUMBER() OVER (PARTITION BY o.org_id ORDER BY o.price DESC NULLS LAST, o.created_at) AS rn
  FROM public.care_test_offerings o
  WHERE o.is_active
    AND COALESCE(o.discount_percent, 0) = 0
    AND o.price > 0
)
UPDATE public.care_test_offerings o
SET discount_percent = CASE
  WHEN r.rn % 5 = 1 THEN 10
  WHEN r.rn % 5 = 2 THEN 8
  ELSE o.discount_percent
END
FROM ranked r
WHERE o.id = r.id
  AND r.rn <= 4;

CREATE OR REPLACE FUNCTION public.care_offering_sale_price(
  _list NUMERIC,
  _discount_percent NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(
    0::numeric,
    ROUND(
      COALESCE(_list, 0) * (1 - LEAST(100, GREATEST(0, COALESCE(_discount_percent, 0))) / 100.0),
      2
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.care_reserve_lab(
  _calendar_id UUID,
  _patient_id UUID DEFAULT NULL,
  _guest_name TEXT DEFAULT NULL,
  _guest_phone TEXT DEFAULT NULL,
  _source TEXT DEFAULT 'app'
)
RETURNS public.care_lab_bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cal public.care_lab_calendars%ROWTYPE;
  off public.care_test_offerings%ROWTYPE;
  booking public.care_lab_bookings%ROWTYPE;
  uid UUID := auth.uid();
  src TEXT := COALESCE(NULLIF(_source, ''), 'app');
  inv_no TEXT;
  list_price NUMERIC(12, 2);
  disc NUMERIC(5, 2);
  sale_price NUMERIC(12, 2);
BEGIN
  SELECT * INTO cal FROM public.care_lab_calendars WHERE id = _calendar_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Slot not found'; END IF;
  IF NOT cal.is_open THEN RAISE EXCEPTION 'Slot closed'; END IF;
  SELECT * INTO off FROM public.care_test_offerings WHERE id = cal.offering_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offering not found'; END IF;

  IF src = 'walk_in' THEN
    IF NOT public.care_has_permission(off.org_id, 'lab.checkin', uid) THEN
      RAISE EXCEPTION 'Not allowed';
    END IF;
  ELSE
    IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
    _patient_id := uid;
  END IF;

  IF cal.reserved_count >= cal.capacity THEN
    RAISE EXCEPTION 'Slot full';
  END IF;

  UPDATE public.care_lab_calendars
  SET reserved_count = reserved_count + 1
  WHERE id = cal.id
    AND reserved_count < capacity
    AND is_open
  RETURNING * INTO cal;
  IF NOT FOUND THEN RAISE EXCEPTION 'Slot full'; END IF;

  list_price := COALESCE(off.price, 0);
  disc := LEAST(100, GREATEST(0, COALESCE(off.discount_percent, 0)));
  sale_price := public.care_offering_sale_price(list_price, disc);

  INSERT INTO public.care_lab_bookings (
    calendar_id, offering_id, org_id, location_id, patient_id,
    guest_name, guest_phone, source, status, price, payment_status,
    price_original, discount_percent
  )
  VALUES (
    cal.id, off.id, off.org_id, cal.location_id, _patient_id,
    NULLIF(_guest_name, ''), NULLIF(_guest_phone, ''), src, 'reserved', sale_price, 'pending',
    CASE WHEN disc > 0 THEN list_price ELSE NULL END,
    CASE WHEN disc > 0 THEN disc ELSE NULL END
  )
  RETURNING * INTO booking;

  inv_no := 'BLT-' || to_char(booking.created_at AT TIME ZONE 'Asia/Dhaka', 'YYYYMMDD') || '-' || upper(substr(replace(booking.id::text, '-', ''), 1, 8));

  UPDATE public.care_lab_bookings
  SET invoice_no = inv_no
  WHERE id = booking.id
  RETURNING * INTO booking;

  PERFORM public.care_write_audit(off.org_id, 'lab.reserve', 'care_lab_bookings', booking.id,
    jsonb_build_object(
      'calendar_id', cal.id,
      'invoice_no', inv_no,
      'price', sale_price,
      'price_original', CASE WHEN disc > 0 THEN list_price ELSE NULL END,
      'discount_percent', CASE WHEN disc > 0 THEN disc ELSE NULL END
    ));

  IF booking.patient_id IS NOT NULL THEN
    PERFORM public.care_notify(
      booking.patient_id, 'care_lab_reserved',
      'Ref ' || booking.reference_code,
      jsonb_build_object('booking_id', booking.id, 'code', booking.reference_code, 'invoice_no', inv_no)
    );
  END IF;

  RETURN booking;
END;
$$;
