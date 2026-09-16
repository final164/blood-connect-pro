-- Default community org + sample donors for Kishoreganj University (upazila: Kishoreganj University)
-- Safe to re-run: org upserted by name+district; donors skipped if same org+phone exists.

DO $$
DECLARE
  v_district_id UUID;
  v_org_id UUID;
  v_org_name TEXT := 'Kishoreganj University Blood Donor Community';
BEGIN
  SELECT id INTO v_district_id FROM public.districts WHERE slug = 'kishoreganj' LIMIT 1;
  IF v_district_id IS NULL THEN
    RAISE NOTICE 'District kishoreganj not found — skip seed';
    RETURN;
  END IF;

  SELECT id INTO v_org_id
  FROM public.community_orgs
  WHERE district_id = v_district_id
    AND name = v_org_name
  LIMIT 1;

  IF v_org_id IS NULL THEN
    INSERT INTO public.community_orgs (
      name,
      name_bn,
      description,
      description_bn,
      phone,
      district_id,
      is_verified,
      is_active,
      sort_order
    )
    VALUES (
      v_org_name,
      'কিশোরগঞ্জ বিশ্ববিদ্যালয় রক্তদাতা কমিউনিটি',
      'Default campus blood donor organization for Kishoreganj University.',
      'কিশোরগঞ্জ বিশ্ববিদ্যালয় ক্যাম্পাসের ডিফল্ট রক্তদাতা সংগঠন।',
      '01712001000',
      v_district_id,
      true,
      true,
      10
    )
    RETURNING id INTO v_org_id;
  ELSE
    UPDATE public.community_orgs
    SET
      name_bn = COALESCE(name_bn, 'কিশোরগঞ্জ বিশ্ববিদ্যালয় রক্তদাতা কমিউনিটি'),
      is_active = true,
      is_verified = true,
      sort_order = LEAST(sort_order, 10)
    WHERE id = v_org_id;
  END IF;

  PERFORM public.ensure_org_default_roles(v_org_id);

  INSERT INTO public.community_donors (
    org_id,
    full_name,
    phone,
    blood_group,
    gender,
    district_id,
    upazila,
    address,
    is_active
  )
  SELECT
    v_org_id,
    d.full_name,
    d.phone,
    d.blood_group,
    d.gender,
    v_district_id,
    'Kishoreganj University',
    d.address,
    true
  FROM (
    VALUES
      ('মো. রফিকুল ইসলাম', '01712001001', 'O+',  'male', 'কিশোরগঞ্জ বিশ্ববিদ্যালয় ক্যাম্পাস'),
      ('আব্দুল করিম',       '01712001002', 'A+',  'male', 'কিশোরগঞ্জ বিশ্ববিদ্যালয়'),
      ('তানভীর হোসেন',     '01712001003', 'B+',  'male', 'কিশোরগঞ্জ বিশ্ববিদ্যালয়'),
      ('সাইফুল ইসলাম',     '01712001004', 'AB+', 'male', 'কিশোরগঞ্জ বিশ্ববিদ্যালয়'),
      ('ইমরান আহমেদ',       '01712001005', 'O-',  'male', 'কিশোরগঞ্জ বিশ্ববিদ্যালয়'),
      ('নাসির উদ্দিন',      '01712001006', 'A-',  'male', 'কিশোরগঞ্জ বিশ্ববিদ্যালয়'),
      ('মাহবুব আলম',        '01712001007', 'B-',  'male', 'কিশোরগঞ্জ বিশ্ববিদ্যালয়'),
      ('জাহিদ হাসান',       '01712001008', 'O+',  'male', 'কিশোরগঞ্জ বিশ্ববিদ্যালয়'),
      ('Ariful Islam',      '01712001009', 'A+',  'male', 'Kishoreganj University'),
      ('রাকিবুল হাসান',     '01712001010', 'B+',  'male', 'কিশোরগঞ্জ বিশ্ববিদ্যালয়')
  ) AS d(full_name, phone, blood_group, gender, address)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.community_donors cd
    WHERE cd.org_id = v_org_id AND cd.phone = d.phone
  );
END $$;
