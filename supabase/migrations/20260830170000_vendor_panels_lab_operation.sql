-- Unlock lab + operation portal desks for chamber / mixed / lab vendor kinds.
-- Valid panels tokens: desk | lab | ambulance | operation

UPDATE public.care_vendor_types
SET panels = ARRAY['desk', 'lab', 'operation']::TEXT[]
WHERE slug = 'chamber';

UPDATE public.care_vendor_types
SET panels = ARRAY['desk', 'lab', 'operation']::TEXT[]
WHERE slug = 'mixed';

UPDATE public.care_vendor_types
SET panels = ARRAY['lab', 'operation']::TEXT[]
WHERE slug IN ('clinic', 'diagnostic', 'hospital_lab');
