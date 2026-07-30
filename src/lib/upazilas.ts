import { supabase } from "@/integrations/supabase/client";
import {
  getAllDistrictUpazilaSeeds,
  getUpazilasForDistrictSlug,
  withDistrictSadar,
  type UpazilaOption,
} from "@/data/bangladesh-clinics";
import type { District } from "@/lib/api";

export type Upazila = {
  id: string;
  district_id: string;
  name_bn: string;
  name_en: string;
  slug: string;
  is_active: boolean;
  sort_order: number;
};

let upazilasTableAvailable: boolean | null = null;

async function upazilasTableExists(): Promise<boolean> {
  if (upazilasTableAvailable != null) return upazilasTableAvailable;
  const { error } = await supabase.from("upazilas").select("id").limit(1);
  upazilasTableAvailable = !error;
  return upazilasTableAvailable;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** DB rows first; catalog fills any gaps so pre-existing bundled upazilas always appear. */
export function mergeUpazilaOptions(db: UpazilaOption[], catalog: UpazilaOption[]): UpazilaOption[] {
  const seen = new Set(db.map((u) => u.en.toLowerCase()));
  const merged = [...db];
  for (const u of catalog) {
    const key = u.en.toLowerCase();
    if (!seen.has(key)) {
      merged.push(u);
      seen.add(key);
    }
  }
  return merged;
}

export function upazilaOptionsFromRows(rows: Upazila[]): UpazilaOption[] {
  return rows.map((u) => ({ en: u.name_en, bn: u.name_bn }));
}

export async function fetchUpazilasForDistrict(districtId: string, admin = false): Promise<Upazila[]> {
  if (!(await upazilasTableExists())) return [];
  let q = supabase
    .from("upazilas")
    .select("id,district_id,name_bn,name_en,slug,is_active,sort_order")
    .eq("district_id", districtId)
    .order("sort_order", { ascending: true })
    .order("name_en", { ascending: true });
  if (!admin) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Upazila[];
}

export async function fetchUpazilaOptions(district: District | null): Promise<UpazilaOption[]> {
  if (!district) return [];
  const catalog = getUpazilasForDistrictSlug(district.slug);
  let list: UpazilaOption[];
  if (await upazilasTableExists()) {
    try {
      const rows = await fetchUpazilasForDistrict(district.id);
      list = mergeUpazilaOptions(upazilaOptionsFromRows(rows), catalog);
    } catch {
      list = catalog;
    }
  } else {
    list = catalog;
  }
  // Always guarantee "{District} Sadar" using live district names (covers DB-only gaps).
  return withDistrictSadar(
    { en: district.name_en, bn: district.name_bn },
    list,
  );
}

export function displayUpazilaName(
  stored: string | null | undefined,
  options: UpazilaOption[],
  lang: "bn" | "en",
): string | null {
  if (!stored) return null;
  const hit = options.find((u) => u.en.toLowerCase() === stored.toLowerCase());
  return hit ? (lang === "bn" ? hit.bn : hit.en) : stored;
}

export async function createUpazila(input: {
  district_id: string;
  name_bn: string;
  name_en: string;
  slug?: string;
  sort_order?: number;
}): Promise<void> {
  const slug = input.slug?.trim() || slugify(input.name_en);
  const { error } = await supabase.from("upazilas").insert({
    district_id: input.district_id,
    name_bn: input.name_bn.trim(),
    name_en: input.name_en.trim(),
    slug,
    sort_order: input.sort_order ?? 0,
  });
  if (error) throw error;
}

export async function updateUpazila(
  id: string,
  patch: Partial<Pick<Upazila, "name_bn" | "name_en" | "slug" | "is_active" | "sort_order">>,
): Promise<void> {
  const { error } = await supabase.from("upazilas").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteUpazila(id: string): Promise<void> {
  const { error } = await supabase.from("upazilas").delete().eq("id", id);
  if (error) throw error;
}

export async function ensureUpazilasForDistrict(district: District): Promise<number> {
  if (!(await upazilasTableExists())) return 0;
  const catalog = getUpazilasForDistrictSlug(district.slug);
  if (!catalog.length) return 0;

  let synced = 0;
  for (let i = 0; i < catalog.length; i++) {
    const u = catalog[i]!;
    const slug = slugify(u.en);
    const { error } = await supabase.from("upazilas").upsert(
      {
        district_id: district.id,
        name_bn: u.bn,
        name_en: u.en,
        slug,
        sort_order: i + 1,
        is_active: true,
      },
      { onConflict: "district_id,slug", ignoreDuplicates: true },
    );
    if (!error) synced++;
  }
  return synced;
}

export async function seedUpazilasFromCatalog(
  districts: District[],
): Promise<{ inserted: number; skipped: number; total: number }> {
  if (!(await upazilasTableExists())) {
    throw new Error("upazilas table not found — run scripts/upazilas.sql first");
  }
  const bySlug = new Map(districts.map((d) => [d.slug, d]));
  const seeds = getAllDistrictUpazilaSeeds();
  let inserted = 0;
  let skipped = 0;
  let total = 0;

  for (const { districtSlug, upazilas } of seeds) {
    const district = bySlug.get(districtSlug);
    if (!district) continue;
    for (let i = 0; i < upazilas.length; i++) {
      const u = upazilas[i]!;
      total++;
      const slug = slugify(u.en);
      const { error } = await supabase.from("upazilas").upsert(
        {
          district_id: district.id,
          name_bn: u.bn,
          name_en: u.en,
          slug,
          sort_order: i + 1,
          is_active: true,
        },
        { onConflict: "district_id,slug", ignoreDuplicates: true },
      );
      if (error) {
        if (error.code === "23505") skipped++;
        else throw error;
      } else {
        inserted++;
      }
    }
  }
  return { inserted, skipped, total };
}
