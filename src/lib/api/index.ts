/**
 * Native-ready API layer — React Native / Flutter can mirror these calls
 * against the same Supabase project. Keep UI-free business logic here.
 */
import { supabase } from "@/integrations/supabase/client";
import { filterHospitalsBySearch } from "@/lib/hospital-search";

export type District = {
  id: string;
  name_bn: string;
  name_en: string;
  slug: string;
  is_active: boolean;
  sort_order: number;
};

export type Hospital = {
  id: string;
  name_bn: string;
  name_en: string;
  slug: string;
  district_id: string | null;
  district_slug?: string | null;
  upazila?: string | null;
  hospital_type: "government" | "private" | "ngo" | "clinic" | "diagnostic";
  is_active: boolean;
};

export type CmsMap = Record<string, { bn: string; en: string }>;

let hospitalsTableAvailable: boolean | null = null;

async function hospitalsTableExists(): Promise<boolean> {
  if (hospitalsTableAvailable != null) return hospitalsTableAvailable;
  const { error } = await supabase.from("hospitals").select("id").limit(1);
  hospitalsTableAvailable = !error;
  return hospitalsTableAvailable;
}

export async function fetchHospitals(opts?: {
  q?: string;
  districtId?: string;
  districtSlug?: string;
  upazila?: string | null;
  limit?: number;
}): Promise<Hospital[]> {
  const upazila = opts?.upazila?.trim() || undefined;
  const limit = opts?.limit ?? (upazila ? 80 : 400);
  const q = opts?.q?.trim() ?? "";
  const searching = q.length > 0;
  // When searching, load a wider pool then filter client-side (substring anywhere in name).
  const fetchCap = searching ? 2000 : Math.max(limit, 500);

  const bundled = await searchBundledHospitals({
    districtId: opts?.districtId,
    districtSlug: opts?.districtSlug,
    upazila,
    limit: fetchCap,
  });

  if (!(await hospitalsTableExists())) {
    return filterHospitalsBySearch(bundled, q).slice(0, limit);
  }

  let query = supabase
    .from("hospitals")
    .select("id,name_bn,name_en,slug,district_id,hospital_type,is_active,upazila,districts(slug)")
    .eq("is_active", true)
    .order("name_en", { ascending: true })
    .limit(fetchCap);
  if (opts?.districtId) query = query.eq("district_id", opts.districtId);
  if (upazila) query = query.ilike("upazila", upazila);

  const { data, error } = await query;
  if (error) {
    if (!/upazila|column/i.test(error.message)) {
      hospitalsTableAvailable = false;
    }
    return filterHospitalsBySearch(bundled, q).slice(0, limit);
  }

  const fromDb = (data ?? []).map((row: any) => ({
    id: row.id as string,
    name_bn: row.name_bn as string,
    name_en: row.name_en as string,
    slug: row.slug as string,
    district_id: row.district_id as string | null,
    district_slug: (row.districts?.slug as string | undefined) ?? null,
    upazila: (row.upazila as string | null) ?? null,
    hospital_type: row.hospital_type as Hospital["hospital_type"],
    is_active: row.is_active as boolean,
  }));

  const bySlug = new Map<string, Hospital>();
  for (const h of bundled) bySlug.set(h.slug, h);
  for (const h of fromDb) bySlug.set(h.slug, h);

  const merged = [...bySlug.values()];
  const ranked = filterHospitalsBySearch(merged, q);
  if (!searching) {
    ranked.sort((a, b) =>
      a.name_en.localeCompare(b.name_en, undefined, { sensitivity: "base" }),
    );
  }
  return ranked.slice(0, limit);
}

async function searchBundledHospitals(opts: {
  districtId?: string;
  districtSlug?: string;
  upazila?: string;
  limit: number;
}): Promise<Hospital[]> {
  const { BANGLADESH_HOSPITALS, hospitalMatchesUpazila } = await import("@/data/bangladesh-hospitals");
  let list = BANGLADESH_HOSPITALS;
  if (opts.districtSlug) {
    const scoped = list.filter((h) => h.districtSlug === opts.districtSlug);
    if (scoped.length > 0) list = scoped;
  }
  if (opts.upazila) {
    list = list.filter((h) => hospitalMatchesUpazila(h, opts.upazila));
  }
  return list.slice(0, opts.limit).map((h) => ({
    id: `seed:${h.districtSlug}:${h.slug}`,
    name_bn: h.name_bn,
    name_en: h.name_en,
    slug: h.slug,
    district_id: opts.districtId ?? null,
    district_slug: h.districtSlug,
    upazila: h.upazila ?? null,
    hospital_type: h.type,
    is_active: true,
  }));
}

export async function fetchHospitalsAdminPage(opts?: {
  offset?: number;
  limit?: number;
  q?: string;
}): Promise<{ items: Hospital[]; hasMore: boolean }> {
  const limit = opts?.limit ?? 25;
  const offset = opts?.offset ?? 0;
  const mapRow = (row: any): Hospital => ({
    id: row.id,
    name_bn: row.name_bn,
    name_en: row.name_en,
    slug: row.slug,
    district_id: row.district_id,
    district_slug: row.districts?.slug ?? null,
    upazila: row.upazila ?? null,
    hospital_type: row.hospital_type,
    is_active: row.is_active,
  });

  if (await hospitalsTableExists()) {
    let query = supabase
      .from("hospitals")
      .select("id,name_bn,name_en,slug,district_id,hospital_type,is_active,upazila,districts(slug)")
      .order("name_en", { ascending: true })
      .range(offset, offset + limit - 1);
    if (opts?.q?.trim()) {
      const term = `%${opts.q.trim()}%`;
      query = query.or(`name_en.ilike.${term},name_bn.ilike.${term},slug.ilike.${term}`);
    }
    const { data, error } = await query;
    if (!error) {
      const items = (data ?? []).map(mapRow);
      return { items, hasMore: items.length >= limit };
    }
  }

  const bundled = await fetchHospitals({ q: opts?.q, limit: 2000 });
  const filtered = filterHospitalsBySearch(bundled, opts?.q ?? "");
  const slice = filtered.slice(offset, offset + limit);
  return { items: slice, hasMore: offset + limit < filtered.length };
}

export async function fetchAllHospitalsAdmin(): Promise<Hospital[]> {
  if (await hospitalsTableExists()) {
    const { data, error } = await supabase
      .from("hospitals")
      .select("id,name_bn,name_en,slug,district_id,hospital_type,is_active,upazila,districts(slug)")
      .order("name_en", { ascending: true });
    if (!error) {
      return (data ?? []).map((row: any) => ({
        id: row.id,
        name_bn: row.name_bn,
        name_en: row.name_en,
        slug: row.slug,
        district_id: row.district_id,
        district_slug: row.districts?.slug ?? null,
        upazila: row.upazila ?? null,
        hospital_type: row.hospital_type,
        is_active: row.is_active,
      }));
    }
  }
  return fetchHospitals({ limit: 500 });
}

export async function fetchDistricts(q?: string): Promise<District[]> {
  let query = supabase
    .from("districts")
    .select("id,name_bn,name_en,slug,is_active,sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(`name_en.ilike.${term},name_bn.ilike.${term},slug.ilike.${term}`);
  }
  const { data, error } = await query.limit(20);
  if (error) throw error;
  return (data ?? []) as District[];
}

export async function fetchDistrictsAdminPage(opts?: {
  offset?: number;
  limit?: number;
}): Promise<{ items: District[]; hasMore: boolean }> {
  const limit = opts?.limit ?? 20;
  const offset = opts?.offset ?? 0;
  const { data, error } = await supabase
    .from("districts")
    .select("id,name_bn,name_en,slug,is_active,sort_order")
    .order("sort_order", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  const items = (data ?? []) as District[];
  return { items, hasMore: items.length >= limit };
}

export async function fetchAllDistrictsAdmin(): Promise<District[]> {
  const { data, error } = await supabase
    .from("districts")
    .select("id,name_bn,name_en,slug,is_active,sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as District[];
}

export async function fetchCmsStrings(): Promise<CmsMap> {
  const { data, error } = await supabase.from("cms_strings").select("key,value_bn,value_en");
  if (error) {
    // Soft-fail before migration is applied
    console.warn("[cms]", error.message);
    return {};
  }
  const map: CmsMap = {};
  for (const row of data ?? []) {
    map[row.key] = { bn: row.value_bn, en: row.value_en };
  }
  return map;
}

export async function hasAdminRole(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProfileDistrict(userId: string, districtId: string | null) {
  const { error } = await supabase.from("profiles").update({ district_id: districtId }).eq("id", userId);
  if (error) throw error;
}

export async function fetchFeed(districtId?: string | null, limit = 50) {
  let q = supabase
    .from("posts")
    .select("id, author_id, content, image_url, created_at, district_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (districtId) q = q.eq("district_id", districtId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchOpenRequests(opts: { districtId?: string | null; bloodGroup?: string | null }) {
  let q = supabase
    .from("blood_requests")
    .select("*")
    .eq("status", "open")
    .order("urgency", { ascending: false })
    .order("needed_by", { ascending: true });
  if (opts.districtId) q = q.eq("district_id", prefsDistrict(opts.districtId));
  if (opts.bloodGroup && opts.bloodGroup !== "ALL") q = q.eq("blood_group", opts.bloodGroup);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

function prefsDistrict(id: string) {
  return id;
}

export async function createPost(input: {
  author_id: string;
  content: string;
  district_id?: string | null;
  image_url?: string | null;
}) {
  const { error } = await supabase.from("posts").insert(input);
  if (error) throw error;
}

export async function toggleLike(postId: string, userId: string, liked: boolean) {
  if (liked) {
    const { error } = await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("post_likes").insert({ post_id: postId, user_id: userId });
    if (error) throw error;
  }
}

export async function fetchComments(postId: string) {
  const { data, error } = await supabase
    .from("post_comments")
    .select("id, post_id, user_id, content, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addComment(postId: string, userId: string, content: string) {
  const { error } = await supabase.from("post_comments").insert({
    post_id: postId,
    user_id: userId,
    content,
  });
  if (error) throw error;
}

export async function sharePost(postId: string, userId: string, channel = "app") {
  const { error } = await supabase.from("post_shares").insert({ post_id: postId, user_id: userId, channel });
  if (error) throw error;
}

export type CommunityOrg = {
  id: string;
  name: string;
  name_bn: string | null;
  description: string | null;
  description_bn: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  district_id: string | null;
  logo_url: string | null;
  is_verified: boolean;
  is_active: boolean;
  sort_order: number;
  donor_contact_settings?: unknown;
  districts?: { name_bn: string; name_en: string } | null;
};

export async function fetchCommunityOrgs(districtId?: string | null): Promise<CommunityOrg[]> {
  // Avoid nested `districts(...)` join — Lovable DBs may lack the FK in PostgREST cache.
  let q = supabase
    .from("community_orgs")
    .select(
      "id,name,name_bn,description,description_bn,website,phone,email,district_id,logo_url,is_verified,is_active,sort_order,donor_contact_settings",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (districtId) q = q.eq("district_id", districtId);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as CommunityOrg[];
  const districtIds = [...new Set(rows.map((r) => r.district_id).filter(Boolean))] as string[];
  if (!districtIds.length) return rows;
  const { data: dists } = await supabase
    .from("districts")
    .select("id,name_bn,name_en")
    .in("id", districtIds);
  const byId = new Map((dists ?? []).map((d) => [d.id, { name_bn: d.name_bn, name_en: d.name_en }]));
  return rows.map((r) => ({
    ...r,
    districts: r.district_id ? byId.get(r.district_id) ?? null : null,
  }));
}

export async function fetchAllDistricts(): Promise<District[]> {
  const { data, error } = await supabase
    .from("districts")
    .select("id,name_bn,name_en,slug,is_active,sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as District[];
}
