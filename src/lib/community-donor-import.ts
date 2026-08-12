import { resolveUpazilaLabel } from "@/data/bangladesh-clinics";
import { BLOOD_GROUPS } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import type { District } from "@/lib/api";

export type CommunityDonorRow = {
  id: string;
  org_id: string;
  full_name: string;
  phone: string;
  blood_group: string | null;
  gender: "male" | "female" | null;
  district_id: string | null;
  upazila: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  unavailable_until?: string | null;
  last_donated_at?: string | null;
  /** org = community_donors row; app = registered profiles user */
  source?: "org" | "app";
  /** Set when source === "app" */
  profile_id?: string | null;
  community_orgs?: {
    name: string;
    name_bn: string | null;
    donor_contact_settings?: unknown;
  } | null;
  districts?: { name_bn: string; name_en: string; slug: string } | null;
};

function phoneDigits(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

function sortDonorsByAvailability(
  rows: CommunityDonorRow[],
  sortUnavailableLast: boolean,
): CommunityDonorRow[] {
  if (!sortUnavailableLast) return rows;
  const now = Date.now();
  return [...rows].sort((a, b) => {
    const ua = isCommunityDonorUnavailable(a, now) ? 1 : 0;
    const ub = isCommunityDonorUnavailable(b, now) ? 1 : 0;
    if (ua !== ub) return ua - ub;
    return (a.full_name || "").localeCompare(b.full_name || "", undefined, { sensitivity: "base" });
  });
}

type AppProfileCommunityRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  blood_group: string | null;
  gender: string | null;
  district_id: string | null;
  area: string | null;
  is_available: boolean | null;
  unavailable_until: string | null;
  created_at: string;
  districts: { name_bn: string; name_en: string; slug: string } | null;
};

function mapAppProfileToDonor(p: AppProfileCommunityRow): CommunityDonorRow {
  const gender = normalizeGender(p.gender);
  const unavailable =
    p.unavailable_until && new Date(p.unavailable_until).getTime() > Date.now()
      ? p.unavailable_until
      : p.is_available === false
        ? "9999-01-01T00:00:00.000Z"
        : null;
  return {
    id: `app:${p.id}`,
    org_id: "",
    full_name: (p.full_name || "").trim() || "User",
    phone: (p.phone || "").trim(),
    blood_group: p.blood_group,
    gender,
    district_id: p.district_id,
    upazila: p.area,
    address: null,
    is_active: true,
    created_at: p.created_at,
    unavailable_until: unavailable,
    source: "app",
    profile_id: p.id,
    community_orgs: {
      name: "BloodLink",
      name_bn: "অ্যাপ ইউজার",
      donor_contact_settings: undefined,
    },
    districts: p.districts,
  };
}

/** Registered app users visible in Community (district / upazila). */
export async function fetchCommunityAppUsers(opts: {
  bloodGroup?: string;
  districtId?: string | null;
  upazila?: string;
  viewerId?: string | null;
  limit?: number;
}): Promise<{ items: CommunityDonorRow[]; hasMore: boolean }> {
  const limit = opts.limit ?? 80;
  const selectCols =
    "id, full_name, phone, blood_group, gender, district_id, area, is_available, unavailable_until, created_at, show_in_community, is_blocked, districts(name_bn, name_en, slug)";

  async function run(withShowFlag: boolean) {
    let q = supabase
      .from("profiles")
      .select(withShowFlag ? selectCols : selectCols.replace(", show_in_community", ""))
      .eq("is_blocked", false)
      .not("phone", "is", null)
      .neq("phone", "");

    if (withShowFlag) q = q.eq("show_in_community", true);
    if (opts.viewerId) q = q.neq("id", opts.viewerId);
    if (opts.bloodGroup && opts.bloodGroup !== "ALL") q = q.eq("blood_group", opts.bloodGroup);
    if (opts.districtId) q = q.eq("district_id", opts.districtId);
    if (opts.upazila?.trim()) q = q.eq("area", opts.upazila.trim());

    return q.order("full_name", { ascending: true }).range(0, limit - 1);
  }

  let { data, error } = await run(true);
  if (error && /show_in_community|column/i.test(error.message)) {
    ({ data, error } = await run(false));
  }
  if (error) throw error;

  const rows = ((data ?? []) as unknown as AppProfileCommunityRow[])
    .filter((p) => phoneDigits(p.phone).length >= 10)
    .map(mapAppProfileToDonor);

  return { items: rows, hasMore: rows.length >= limit };
}

/**
 * Org donors + (optional) app users for Community page.
 * App users load on the first page only and are deduped against org rows by phone.
 */
export async function fetchCommunityListing(opts: {
  bloodGroup?: string;
  districtId?: string | null;
  upazila?: string;
  orgId?: string | null;
  offset?: number;
  limit?: number;
  sortUnavailableLast?: boolean;
  includeAppUsers?: boolean;
  viewerId?: string | null;
}): Promise<{ items: CommunityDonorRow[]; hasMore: boolean }> {
  const offset = opts.offset ?? 0;
  const sortUnavailableLast = opts.sortUnavailableLast !== false;
  const includeApp = !!opts.includeAppUsers && !opts.orgId;

  const orgPromise = fetchCommunityDonors({
    bloodGroup: opts.bloodGroup,
    districtId: opts.districtId,
    upazila: opts.upazila,
    orgId: opts.orgId,
    offset,
    limit: opts.limit,
    sortUnavailableLast,
  });

  const appPromise =
    includeApp && offset === 0
      ? fetchCommunityAppUsers({
          bloodGroup: opts.bloodGroup,
          districtId: opts.districtId,
          upazila: opts.upazila,
          viewerId: opts.viewerId,
        })
      : Promise.resolve({ items: [] as CommunityDonorRow[], hasMore: false });

  const [org, app] = await Promise.all([orgPromise, appPromise]);

  const appPhones = new Set(
    app.items.map((d) => phoneDigits(d.phone)).filter((p) => p.length >= 10),
  );
  const orgItems = org.items.filter((d) => {
    const p = phoneDigits(d.phone);
    return !p || !appPhones.has(p);
  });

  const merged =
    offset === 0 ? sortDonorsByAvailability([...app.items, ...orgItems], sortUnavailableLast) : orgItems;

  return { items: merged, hasMore: org.hasMore };
}

/** True while cooldown is active (unavailable_until in the future). */
export function isCommunityDonorUnavailable(
  donor: Pick<CommunityDonorRow, "unavailable_until">,
  now = Date.now(),
): boolean {
  const raw = donor.unavailable_until;
  if (!raw) return false;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) && t > now;
}

export type DonorGender = "male" | "female";

/** File columns: name, phone, blood_group, gender, address (optional). District/upazila from form. */
export type DonorImportInput = {
  name: string;
  phone: string;
  blood_group?: string | null;
  gender?: string | null;
  address?: string | null;
};

const HEADER_ALIASES: Record<string, keyof DonorImportInput> = {
  name: "name",
  full_name: "name",
  "full name": "name",
  নাম: "name",
  phone: "phone",
  phone_number: "phone",
  mobile: "phone",
  contact: "phone",
  ফোন: "phone",
  blood_group: "blood_group",
  "blood group": "blood_group",
  bloodgroup: "blood_group",
  bg: "blood_group",
  group: "blood_group",
  রক্তের_গ্রুপ: "blood_group",
  "রক্তের গ্রুপ": "blood_group",
  gender: "gender",
  sex: "gender",
  লিঙ্গ: "gender",
  address: "address",
  ঠিকানা: "address",
};

function normHeader(h: string) {
  return h.trim().toLowerCase().replace(/^\uFEFF/, "");
}

function parseCsv(text: string): DonorImportInput[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(",").map(normHeader);
  const keys = headers.map((h) => HEADER_ALIASES[h] ?? null);
  const rows: DonorImportInput[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const row: DonorImportInput = { name: "", phone: "" };
    keys.forEach((k, idx) => {
      if (!k || !cols[idx]) return;
      (row as Record<string, string>)[k] = cols[idx]!;
    });
    if (row.name.trim() && row.phone.trim()) rows.push(row);
  }
  return rows;
}

function parseJson(text: string): DonorImportInput[] {
  const data = JSON.parse(text) as unknown;
  const list = Array.isArray(data) ? data : [data];
  return list
    .map((item: Record<string, unknown>) => ({
      name: String(item.name ?? item.full_name ?? item.Name ?? "").trim(),
      phone: String(item.phone ?? item.phone_number ?? item.mobile ?? item.Phone ?? "").trim(),
      blood_group: item.blood_group || item.Blood_group || item["blood group"]
        ? String(item.blood_group ?? item.Blood_group ?? item["blood group"]).trim()
        : null,
      gender: item.gender || item.Gender || item.sex
        ? String(item.gender ?? item.Gender ?? item.sex).trim()
        : null,
      address: item.address || item.Address
        ? String(item.address ?? item.Address).trim()
        : null,
    }))
    .filter((r) => r.name && r.phone);
}

async function parseXlsx(file: File): Promise<DonorImportInput[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  if (!sheet) return [];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return json
    .map((item) => {
      const mapped: DonorImportInput = { name: "", phone: "" };
      for (const [rawKey, val] of Object.entries(item)) {
        const key = HEADER_ALIASES[normHeader(rawKey)];
        if (!key) continue;
        const s = String(val ?? "").trim();
        if (!s) continue;
        (mapped as Record<string, string | null>)[key] = s;
      }
      return mapped;
    })
    .filter((r) => r.name.trim() && r.phone.trim());
}

export async function parseDonorImportFile(file: File): Promise<DonorImportInput[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".json")) return parseJson(await file.text());
  if (name.endsWith(".csv")) return parseCsv(await file.text());
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return parseXlsx(file);
  const text = await file.text();
  try {
    return parseJson(text);
  } catch {
    return parseCsv(text);
  }
}

function normalizeBloodGroup(bg: string | null | undefined): string | null {
  if (!bg?.trim()) return null;
  const u = bg.trim().toUpperCase().replace(/\s/g, "");
  const found = BLOOD_GROUPS.find((g) => g.replace(/\s/g, "") === u);
  return found ?? null;
}

export function normalizeGender(raw: string | null | undefined): DonorGender | null {
  if (!raw?.trim()) return null;
  const g = raw.trim().toLowerCase();
  if (g === "male" || g === "m" || g === "পুরুষ" || g === "ছেলে") return "male";
  if (g === "female" || g === "f" || g === "মহিলা" || g === "নারী" || g === "মেয়ে" || g === "মেয়ে") return "female";
  return null;
}

export type DonorImportLocation = {
  districtId: string;
  upazila?: string | null;
  /** Applied when a row has no gender in the file */
  gender?: DonorGender | null;
};

export async function bulkImportCommunityDonors(
  orgId: string,
  rows: DonorImportInput[],
  location: DonorImportLocation,
  districts: District[],
): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  if (!location.districtId) {
    return { inserted: 0, skipped: rows.length, errors: ["District is required"] };
  }
  const districtHit = districts.find((d) => d.id === location.districtId);
  const upazila = resolveUpazilaLabel(location.upazila, districtHit?.slug ?? null);

  const payload = rows
    .map((r, i) => {
      const phone = r.phone.replace(/\D/g, "");
      if (phone.length < 10) {
        errors.push(`Row ${i + 1}: invalid phone`);
        return null;
      }
      const bg = normalizeBloodGroup(r.blood_group);
      if (r.blood_group?.trim() && !bg) {
        errors.push(`Row ${i + 1}: invalid blood group "${r.blood_group}"`);
      }
      const gender = normalizeGender(r.gender) ?? location.gender ?? null;
      if (r.gender?.trim() && !normalizeGender(r.gender)) {
        errors.push(`Row ${i + 1}: invalid gender "${r.gender}" (use male/female)`);
        return null;
      }
      if (!gender) {
        errors.push(`Row ${i + 1}: gender required (male/female)`);
        return null;
      }
      return {
        org_id: orgId,
        full_name: r.name.trim(),
        phone: r.phone.trim(),
        blood_group: bg,
        gender,
        district_id: location.districtId,
        upazila,
        address: r.address?.trim() || null,
        is_active: true,
      };
    })
    .filter(Boolean) as Record<string, unknown>[];

  if (!payload.length) return { inserted: 0, skipped: rows.length, errors };

  let inserted = 0;
  for (let i = 0; i < payload.length; i += 100) {
    const chunk = payload.slice(i, i + 100);
    const { error } = await supabase.from("community_donors").insert(chunk);
    if (error) {
      errors.push(error.message);
      break;
    }
    inserted += chunk.length;
  }
  return { inserted, skipped: rows.length - inserted, errors };
}

export async function fetchCommunityDonors(opts: {
  bloodGroup?: string;
  districtId?: string | null;
  upazila?: string;
  orgId?: string | null;
  offset?: number;
  limit?: number;
  /** Put available donors before cooldown donors (default true) */
  sortUnavailableLast?: boolean;
}): Promise<{ items: CommunityDonorRow[]; hasMore: boolean }> {
  const limit = opts.limit ?? 24;
  const offset = opts.offset ?? 0;
  const sortUnavailableLast = opts.sortUnavailableLast !== false;
  let q = supabase
    .from("community_donors")
    .select(
      "id, org_id, full_name, phone, blood_group, gender, district_id, upazila, address, is_active, created_at, unavailable_until, last_donated_at, community_orgs(name, name_bn, donor_contact_settings), districts(name_bn, name_en, slug)",
    )
    .eq("is_active", true);

  if (opts.bloodGroup && opts.bloodGroup !== "ALL") {
    q = q.eq("blood_group", opts.bloodGroup);
  }
  if (opts.districtId) q = q.eq("district_id", opts.districtId);
  if (opts.upazila?.trim()) {
    q = q.eq("upazila", opts.upazila.trim());
  }
  if (opts.orgId) q = q.eq("org_id", opts.orgId);

  // Available (null / expired) first when sorting unavailable last
  if (sortUnavailableLast) {
    q = q
      .order("unavailable_until", { ascending: true, nullsFirst: true })
      .order("full_name", { ascending: true });
  } else {
    q = q.order("full_name", { ascending: true });
  }

  q = q.range(offset, offset + limit - 1);

  const { data, error } = await q;
  if (error) {
    // Older DBs may lack cooldown columns — retry without them
    if (/unavailable_until|last_donated_at|column/i.test(error.message)) {
      let q2 = supabase
        .from("community_donors")
        .select(
          "id, org_id, full_name, phone, blood_group, gender, district_id, upazila, address, is_active, created_at, community_orgs(name, name_bn, donor_contact_settings), districts(name_bn, name_en, slug)",
        )
        .eq("is_active", true)
        .order("full_name", { ascending: true })
        .range(offset, offset + limit - 1);
      if (opts.bloodGroup && opts.bloodGroup !== "ALL") q2 = q2.eq("blood_group", opts.bloodGroup);
      if (opts.districtId) q2 = q2.eq("district_id", opts.districtId);
      if (opts.upazila?.trim()) q2 = q2.eq("upazila", opts.upazila.trim());
      if (opts.orgId) q2 = q2.eq("org_id", opts.orgId);
      const retry = await q2;
      if (retry.error) throw retry.error;
      const rows = (retry.data ?? []) as unknown as CommunityDonorRow[];
      return { items: rows, hasMore: rows.length >= limit };
    }
    throw error;
  }
  let rows = (data ?? []) as unknown as CommunityDonorRow[];
  rows = rows.map((r) => ({ ...r, source: r.source ?? "org" }));
  if (sortUnavailableLast) {
    rows = sortDonorsByAvailability(rows, true);
  }
  return { items: rows, hasMore: rows.length >= limit };
}

export async function fetchCommunityDonorsByOrg(orgId: string) {
  const { data, error } = await supabase
    .from("community_donors")
    .select(
      "id, org_id, full_name, phone, blood_group, gender, district_id, upazila, address, is_active, created_at, districts(name_bn, name_en, slug)",
    )
    .eq("org_id", orgId)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CommunityDonorRow[];
}

export async function updateCommunityDonor(
  id: string,
  input: {
    full_name: string;
    phone: string;
    blood_group?: string | null;
    gender?: string | null;
    district_id?: string | null;
    upazila?: string | null;
    address?: string | null;
    is_active?: boolean;
  },
  districts: District[],
) {
  const phone = input.phone.replace(/\D/g, "");
  if (phone.length < 10) throw new Error("Invalid phone");
  const districtHit = input.district_id ? districts.find((d) => d.id === input.district_id) : undefined;
  const gender = normalizeGender(input.gender);
  if (input.gender?.trim() && !gender) throw new Error("Invalid gender");
  const { error } = await supabase
    .from("community_donors")
    .update({
      full_name: input.full_name.trim(),
      phone: input.phone.trim(),
      blood_group: normalizeBloodGroup(input.blood_group),
      gender,
      district_id: input.district_id || null,
      upazila: resolveUpazilaLabel(input.upazila, districtHit?.slug ?? null),
      address: input.address?.trim() || null,
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCommunityDonor(id: string) {
  const { error } = await supabase.from("community_donors").delete().eq("id", id);
  if (error) throw error;
}
