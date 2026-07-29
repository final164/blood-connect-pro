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
  district_id: string | null;
  upazila: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  community_orgs?: { name: string; name_bn: string | null } | null;
  districts?: { name_bn: string; name_en: string; slug: string } | null;
};

export type DonorImportInput = {
  name: string;
  phone: string;
  blood_group?: string | null;
  district?: string | null;
  upazila?: string | null;
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
  blood_group: "blood_group",
  "blood group": "blood_group",
  bloodgroup: "blood_group",
  group: "blood_group",
  district: "district",
  জেলা: "district",
  upazila: "upazila",
  upazilla: "upazila",
  subdistrict: "upazila",
  উপজেলা: "upazila",
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
      name: String(item.name ?? item.full_name ?? "").trim(),
      phone: String(item.phone ?? item.phone_number ?? item.mobile ?? "").trim(),
      blood_group: item.blood_group ? String(item.blood_group).trim() : null,
      district: item.district ? String(item.district).trim() : null,
      upazila: item.upazila ? String(item.upazila).trim() : null,
      address: item.address ? String(item.address).trim() : null,
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
        (mapped as Record<string, string | null>)[key] = String(val ?? "").trim() || null;
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

function resolveDistrictId(label: string | null | undefined, districts: District[]): string | null {
  if (!label?.trim()) return null;
  const q = label.trim().toLowerCase();
  const hit = districts.find(
    (d) =>
      d.name_en.toLowerCase() === q ||
      d.name_bn.toLowerCase() === q ||
      d.slug.toLowerCase() === q ||
      d.name_en.toLowerCase().includes(q) ||
      d.name_bn.includes(label.trim()),
  );
  return hit?.id ?? null;
}

function normalizeBloodGroup(bg: string | null | undefined): string | null {
  if (!bg?.trim()) return null;
  const u = bg.trim().toUpperCase().replace(/\s/g, "");
  const found = BLOOD_GROUPS.find((g) => g.replace(/\s/g, "") === u);
  return found ?? null;
}

export async function bulkImportCommunityDonors(
  orgId: string,
  rows: DonorImportInput[],
  districts: District[],
): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
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
      const districtId = resolveDistrictId(r.district, districts);
      const districtHit = districtId ? districts.find((d) => d.id === districtId) : undefined;
      return {
        org_id: orgId,
        full_name: r.name.trim(),
        phone: r.phone.trim(),
        blood_group: bg,
        district_id: districtId,
        upazila: resolveUpazilaLabel(r.upazila, districtHit?.slug ?? null),
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
}) {
  let q = supabase
    .from("community_donors")
    .select(
      "id, org_id, full_name, phone, blood_group, district_id, upazila, address, is_active, created_at, community_orgs(name, name_bn), districts(name_bn, name_en, slug)",
    )
    .eq("is_active", true)
    .order("full_name", { ascending: true })
    .limit(200);

  if (opts.bloodGroup && opts.bloodGroup !== "ALL") {
    q = q.eq("blood_group", opts.bloodGroup);
  }
  if (opts.districtId) q = q.eq("district_id", opts.districtId);
  if (opts.upazila?.trim()) {
    q = q.eq("upazila", opts.upazila.trim());
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as CommunityDonorRow[];
}

export async function fetchCommunityDonorsByOrg(orgId: string) {
  const { data, error } = await supabase
    .from("community_donors")
    .select(
      "id, org_id, full_name, phone, blood_group, district_id, upazila, address, is_active, created_at, districts(name_bn, name_en, slug)",
    )
    .eq("org_id", orgId)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CommunityDonorRow[];
}

export async function updateCommunityDonor(
  id: string,
  input: {
    full_name: string;
    phone: string;
    blood_group?: string | null;
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
  const { error } = await supabase
    .from("community_donors")
    .update({
      full_name: input.full_name.trim(),
      phone: input.phone.trim(),
      blood_group: normalizeBloodGroup(input.blood_group),
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
