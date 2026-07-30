/**
 * Seed district_neighbors + upazila_neighbors from catalogs, then refresh hop distances.
 * Call after districts/upazilas exist (Admin seed upazilas / hospitals).
 */
import { supabase } from "@/integrations/supabase/client";
import { DISTRICT_NEIGHBOR_PAIRS } from "@/data/district-neighbors";
import { getDhakaUpazilaNeighborSlugPairs } from "@/data/upazila-neighbors";

export async function seedGeoNeighborsFromCatalog(): Promise<{
  districts: number;
  upazilas: number;
  hopsRefreshed: boolean;
}> {
  const { data: districts, error: dErr } = await supabase
    .from("districts")
    .select("id,slug");
  if (dErr) throw dErr;
  const bySlug = new Map((districts ?? []).map((d) => [d.slug as string, d.id as string]));

  let districtInserted = 0;
  const districtRows: { district_id: string; neighbor_district_id: string }[] = [];
  for (const [a, b] of DISTRICT_NEIGHBOR_PAIRS) {
    const idA = bySlug.get(a);
    const idB = bySlug.get(b);
    if (!idA || !idB || idA === idB) continue;
    const lo = idA < idB ? idA : idB;
    const hi = idA < idB ? idB : idA;
    districtRows.push({ district_id: lo, neighbor_district_id: hi });
  }
  for (let i = 0; i < districtRows.length; i += 80) {
    const slice = districtRows.slice(i, i + 80);
    const { error } = await supabase.from("district_neighbors").upsert(slice, {
      onConflict: "district_id,neighbor_district_id",
    });
    if (error) throw error;
    districtInserted += slice.length;
  }

  // Sadar-star for every district (from upazilas table)
  const { data: upazilas, error: uErr } = await supabase
    .from("upazilas")
    .select("district_id,slug,name_en");
  if (uErr) throw uErr;

  const byDistrict = new Map<string, { slug: string; name_en: string }[]>();
  for (const u of upazilas ?? []) {
    const list = byDistrict.get(u.district_id as string) ?? [];
    list.push({ slug: u.slug as string, name_en: (u.name_en as string) ?? "" });
    byDistrict.set(u.district_id as string, list);
  }

  const upazilaRows: {
    district_id: string;
    upazila_slug_a: string;
    upazila_slug_b: string;
    weight: number;
  }[] = [];
  const seen = new Set<string>();

  function pushEdge(districtId: string, a: string, b: string, weight = 1) {
    if (!a || !b || a === b) return;
    const lo = a < b ? a : b;
    const hi = a < b ? b : a;
    const key = `${districtId}:${lo}:${hi}`;
    if (seen.has(key)) return;
    seen.add(key);
    upazilaRows.push({
      district_id: districtId,
      upazila_slug_a: lo,
      upazila_slug_b: hi,
      weight,
    });
  }

  for (const [districtId, list] of byDistrict) {
    const sadar = list.find(
      (u) =>
        /sadar$/i.test(u.slug) ||
        /sadar$/i.test(u.name_en.trim()) ||
        /^sadar$/i.test(u.name_en.trim()),
    );
    if (!sadar) continue;
    for (const u of list) {
      if (u.slug === sadar.slug) continue;
      pushEdge(districtId, sadar.slug, u.slug, 1);
    }
  }

  const dhakaId = bySlug.get("dhaka");
  if (dhakaId) {
    for (const [a, b] of getDhakaUpazilaNeighborSlugPairs()) {
      pushEdge(dhakaId, a, b, 1);
    }
  }

  let upazilaInserted = 0;
  for (let i = 0; i < upazilaRows.length; i += 80) {
    const slice = upazilaRows.slice(i, i + 80);
    const { error } = await supabase.from("upazila_neighbors").upsert(slice, {
      onConflict: "district_id,upazila_slug_a,upazila_slug_b",
    });
    if (error) throw error;
    upazilaInserted += slice.length;
  }

  const { error: refreshErr } = await supabase.rpc("refresh_upazila_geo_distance");
  if (refreshErr) throw refreshErr;

  return {
    districts: districtInserted,
    upazilas: upazilaInserted,
    hopsRefreshed: true,
  };
}

export async function refreshUpazilaGeoDistance(): Promise<number> {
  const { data, error } = await supabase.rpc("refresh_upazila_geo_distance");
  if (error) throw error;
  return typeof data === "number" ? data : Number(data) || 0;
}

export async function fetchProximityGraphStats(): Promise<{
  districtEdges: number;
  upazilaEdges: number;
  hopPairs: number;
  ready: boolean;
  error?: string;
}> {
  try {
    const [d, u, h] = await Promise.all([
      supabase.from("district_neighbors").select("district_id", { count: "exact", head: true }),
      supabase.from("upazila_neighbors").select("district_id", { count: "exact", head: true }),
      supabase.from("upazila_geo_distance").select("district_id", { count: "exact", head: true }),
    ]);
    if (d.error || u.error || h.error) {
      const msg = d.error?.message || u.error?.message || h.error?.message || "missing tables";
      return { districtEdges: 0, upazilaEdges: 0, hopPairs: 0, ready: false, error: msg };
    }
    return {
      districtEdges: d.count ?? 0,
      upazilaEdges: u.count ?? 0,
      hopPairs: h.count ?? 0,
      ready: true,
    };
  } catch (e) {
    return {
      districtEdges: 0,
      upazilaEdges: 0,
      hopPairs: 0,
      ready: false,
      error: (e as Error).message,
    };
  }
}
