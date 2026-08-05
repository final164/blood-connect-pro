import { supabase } from "@/integrations/supabase/client";
import {
  fetchContactsForRequests,
  type CommunityRequestContact,
} from "@/lib/community-request-contacts";

export type ExportLang = "bn" | "en";

/** Raw blood_requests row — every DB column is preserved. */
export type RequestExportRow = Record<string, unknown> & {
  id: string;
  patient_name?: string | null;
  blood_group?: string | null;
};

type FlatContact = CommunityRequestContact & {
  patient_name?: string | null;
  blood_group?: string | null;
};

/** Preferred column order; any extra DB columns are appended automatically. */
const REQUEST_COLUMN_ORDER = [
  "id",
  "patient_name",
  "blood_group",
  "bags_needed",
  "hospital_name",
  "hospital_id",
  "area",
  "city",
  "district_id",
  "status",
  "urgency",
  "need_reason_key",
  "need_reason_label",
  "contact_phone",
  "whatsapp_phone",
  "notes",
  "image_url",
  "latitude",
  "longitude",
  "needed_by",
  "from_community",
  "org_id",
  "requester_id",
  "donation_completion_open",
  "like_count",
  "comment_count",
  "share_count",
  "created_at",
  "updated_at",
] as const;

const REQUEST_LABELS: Record<string, { en: string; bn: string }> = {
  id: { en: "Request ID", bn: "রিকোয়েস্ট আইডি" },
  patient_name: { en: "Patient name", bn: "রোগীর নাম" },
  blood_group: { en: "Blood group", bn: "রক্তের গ্রুপ" },
  bags_needed: { en: "Bags needed", bn: "প্রয়োজনীয় ব্যাগ" },
  hospital_name: { en: "Hospital", bn: "হাসপাতাল" },
  hospital_id: { en: "Hospital ID", bn: "হাসপাতাল আইডি" },
  area: { en: "Area / Upazila", bn: "এলাকা / উপজেলা" },
  city: { en: "City / District", bn: "শহর / জেলা" },
  district_id: { en: "District ID", bn: "জেলা আইডি" },
  status: { en: "Status", bn: "স্ট্যাটাস" },
  urgency: { en: "Urgency", bn: "জরুরি অবস্থা" },
  need_reason_key: { en: "Need reason key", bn: "কারণ কী" },
  need_reason_label: { en: "Need reason", bn: "প্রয়োজনের কারণ" },
  contact_phone: { en: "Contact phone", bn: "যোগাযোগের নম্বর" },
  whatsapp_phone: { en: "WhatsApp", bn: "হোয়াটসঅ্যাপ" },
  notes: { en: "Notes / full post text", bn: "নোট / সম্পূর্ণ পোস্ট" },
  image_url: { en: "Image URL", bn: "ছবির লিংক" },
  latitude: { en: "Latitude", bn: "অক্ষাংশ" },
  longitude: { en: "Longitude", bn: "দ্রাঘিমাংশ" },
  needed_by: { en: "Needed by", bn: "প্রয়োজনের তারিখ" },
  from_community: { en: "From community", bn: "কমিউনিটি থেকে" },
  org_id: { en: "Org ID", bn: "অর্গ আইডি" },
  requester_id: { en: "Requester ID", bn: "রিকোয়েস্টার আইডি" },
  donation_completion_open: { en: "Donation completion open", bn: "ডোনেশন সম্পন্ন ওপেন" },
  like_count: { en: "Likes", bn: "লাইক" },
  comment_count: { en: "Comments", bn: "কমেন্ট" },
  share_count: { en: "Shares", bn: "শেয়ার" },
  created_at: { en: "Created at", bn: "তৈরির সময়" },
  updated_at: { en: "Updated at", bn: "আপডেট সময়" },
  contacts_count: { en: "Donors contacted (count)", bn: "কন্টাক্ট করা ডোনার (সংখ্যা)" },
  contacted_donors: { en: "Contacted donors (detail)", bn: "কন্টাক্ট করা ডোনার (বিস্তারিত)" },
};

const CONTACT_COLUMN_ORDER = [
  "id",
  "request_id",
  "patient_name",
  "blood_group",
  "donor_name",
  "donor_phone",
  "channel",
  "outcome",
  "bags",
  "notes",
  "contacted_by",
  "matched_profile_id",
  "assigned_by",
  "donation_id",
  "donated_at",
  "org_id",
  "community_donor_id",
  "created_at",
  "updated_at",
] as const;

const CONTACT_LABELS: Record<string, { en: string; bn: string }> = {
  id: { en: "Contact ID", bn: "কন্টাক্ট আইডি" },
  request_id: { en: "Request ID", bn: "রিকোয়েস্ট আইডি" },
  patient_name: { en: "Patient", bn: "রোগী" },
  blood_group: { en: "Blood group", bn: "রক্তের গ্রুপ" },
  donor_name: { en: "Donor name", bn: "ডোনারের নাম" },
  donor_phone: { en: "Donor phone", bn: "ডোনার ফোন" },
  channel: { en: "Channel", bn: "মাধ্যম" },
  outcome: { en: "Outcome", bn: "ফলাফল" },
  bags: { en: "Bags", bn: "ব্যাগ" },
  notes: { en: "Notes", bn: "নোট" },
  contacted_by: { en: "Contacted by", bn: "কন্টাক্ট করেছেন" },
  matched_profile_id: { en: "Matched profile ID", bn: "ম্যাচড প্রোফাইল" },
  assigned_by: { en: "Assigned by", bn: "অ্যাসাইন করেছেন" },
  donation_id: { en: "Donation ID", bn: "ডোনেশন আইডি" },
  donated_at: { en: "Donated at", bn: "ডোনেশন সময়" },
  org_id: { en: "Org ID", bn: "অর্গ আইডি" },
  community_donor_id: { en: "Community donor ID", bn: "কমিউনিটি ডোনার আইডি" },
  created_at: { en: "Contacted at", bn: "কন্টাক্ট সময়" },
  updated_at: { en: "Updated at", bn: "আপডেট সময়" },
};

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function labelOf(
  map: Record<string, { en: string; bn: string }>,
  key: string,
  lang: ExportLang,
): string {
  return map[key]?.[lang] ?? key;
}

function cell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function yn(v: unknown, lang: ExportLang): string {
  if (v == null || v === "") return "";
  const b = v === true || v === "true" || v === 1 || v === "1";
  if (lang === "bn") return b ? "হ্যাঁ" : "না";
  return b ? "Yes" : "No";
}

function escapeCsv(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

function formatContactSummary(contacts: CommunityRequestContact[], lang: ExportLang): string {
  if (!contacts.length) return "";
  return contacts
    .map((c) => {
      const name = c.donor_name?.trim() || (lang === "bn" ? "ডোনার" : "Donor");
      const outcome =
        c.outcome === "donated"
          ? lang === "bn"
            ? "রক্ত দিয়েছে"
            : "donated"
          : c.outcome === "cancelled"
            ? lang === "bn"
              ? "বাতিল"
              : "cancelled"
            : lang === "bn"
              ? "কন্টাক্ট"
              : "contacted";
      return `${name} (${c.donor_phone}) [${c.channel}/${outcome}]`;
    })
    .join("; ");
}

function collectRequestColumns(requests: RequestExportRow[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const k of REQUEST_COLUMN_ORDER) {
    seen.add(k);
    keys.push(k);
  }
  for (const r of requests) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  // Derived helpers always last
  for (const k of ["contacts_count", "contacted_donors"] as const) {
    if (!seen.has(k)) {
      seen.add(k);
      keys.push(k);
    }
  }
  return keys;
}

function requestRecord(
  r: RequestExportRow,
  columns: string[],
  contacts: CommunityRequestContact[],
  lang: ExportLang,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of columns) {
    if (k === "contacts_count") {
      out[k] = String(contacts.length);
      continue;
    }
    if (k === "contacted_donors") {
      out[k] = formatContactSummary(contacts, lang);
      continue;
    }
    const v = r[k];
    if (k === "from_community" || k === "donation_completion_open") {
      out[k] = yn(v, lang);
    } else {
      // Full notes / post text — never strip community meta on export
      out[k] = cell(v);
    }
  }
  return out;
}

function flattenContacts(
  requests: RequestExportRow[],
  contactsByReq: Record<string, CommunityRequestContact[]>,
): FlatContact[] {
  const out: FlatContact[] = [];
  for (const r of requests) {
    for (const c of contactsByReq[r.id] ?? []) {
      out.push({
        ...c,
        patient_name: (r.patient_name as string | null | undefined) ?? null,
        blood_group: (r.blood_group as string | null | undefined) ?? null,
      });
    }
  }
  return out;
}

function collectContactColumns(contacts: FlatContact[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const k of CONTACT_COLUMN_ORDER) {
    seen.add(k);
    keys.push(k);
  }
  for (const c of contacts) {
    for (const k of Object.keys(c)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  return keys;
}

function contactRecord(c: FlatContact, columns: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of columns) out[k] = cell((c as Record<string, unknown>)[k]);
  return out;
}

function buildCsvTable(
  headers: string[],
  keys: string[],
  rows: Record<string, string>[],
): string {
  const head = headers.map(escapeCsv).join(",");
  const body = rows.map((row) => keys.map((k) => escapeCsv(row[k] ?? "")).join(","));
  return [head, ...body].join("\r\n");
}

function csvBlob(content: string): Blob {
  return new Blob(["\uFEFF" + content + "\r\n"], { type: "text/csv;charset=utf-8" });
}

function labeledRows(
  rows: Record<string, string>[],
  keys: string[],
  labelMap: Record<string, { en: string; bn: string }>,
  lang: ExportLang,
): Record<string, string>[] {
  return rows.map((row) => {
    const labeled: Record<string, string> = {};
    for (const k of keys) labeled[labelOf(labelMap, k, lang)] = row[k] ?? "";
    return labeled;
  });
}

function sqlLiteral(value: unknown): string {
  if (value == null) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "object") {
    const json = JSON.stringify(value);
    return sqlLiteral(json) + "::jsonb";
  }
  const s = String(value);
  let tag = "bl";
  let n = 0;
  while (s.includes(`$${tag}$`)) {
    n += 1;
    tag = `bl${n}`;
  }
  return `$${tag}$${s}$${tag}$`;
}

function sqlComment(lang: ExportLang, requests: number, contacts: number): string {
  const when = new Date().toISOString();
  if (lang === "bn") {
    return [
      "-- BloodLink · সম্পূর্ণ রক্তের অনুরোধ এক্সপোর্ট (সব কলাম)",
      `-- তৈরি: ${when}`,
      `-- এনকোডিং: UTF-8`,
      `-- রিকোয়েস্ট: ${requests} · কন্টাক্ট: ${contacts}`,
      "-- সতর্কতা: প্রোডাকশনে চালানোর আগে ব্যাকআপ নিন। ON CONFLICT DO NOTHING।",
      "",
    ].join("\n");
  }
  return [
    "-- BloodLink · full blood requests export (all columns)",
    `-- Generated: ${when}`,
    `-- Encoding: UTF-8`,
    `-- Requests: ${requests} · Contacts: ${contacts}`,
    "-- Caution: take a backup before running in production. Uses ON CONFLICT DO NOTHING.",
    "",
  ].join("\n");
}

/** Pull every column from blood_requests + contacts. */
export async function loadRequestsExportBundle(limit = 5000): Promise<{
  requests: RequestExportRow[];
  contactsByReq: Record<string, CommunityRequestContact[]>;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("blood_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { requests: [], contactsByReq: {}, error: new Error(error.message) };
  }

  const requests = (data ?? []) as RequestExportRow[];
  const contactsByReq = await fetchContactsForRequests(requests.map((r) => r.id));
  return { requests, contactsByReq, error: null };
}

function buildSummaryRows(
  requests: RequestExportRow[],
  contactsByReq: Record<string, CommunityRequestContact[]>,
  lang: ExportLang,
): Record<string, string | number>[] {
  const flat = flattenContacts(requests, contactsByReq);
  const columns = collectRequestColumns(requests);

  const byStatus: Record<string, number> = {};
  const byGroup: Record<string, number> = {};
  const byUrgency: Record<string, number> = {};
  const byCity: Record<string, number> = {};
  let community = 0;

  for (const r of requests) {
    const st = String(r.status ?? "");
    const bg = String(r.blood_group ?? "");
    const urg = String(r.urgency ?? "");
    const city = String(r.city ?? "").trim() || (lang === "bn" ? "(শহর নেই)" : "(no city)");
    if (st) byStatus[st] = (byStatus[st] ?? 0) + 1;
    if (bg) byGroup[bg] = (byGroup[bg] ?? 0) + 1;
    if (urg) byUrgency[urg] = (byUrgency[urg] ?? 0) + 1;
    byCity[city] = (byCity[city] ?? 0) + 1;
    if (r.from_community === true) community += 1;
  }

  const metric = lang === "bn" ? "বিভাগ" : "Metric";
  const countLbl = lang === "bn" ? "সংখ্যা" : "Count";

  return [
    {
      [metric]: lang === "bn" ? "মোট রিকোয়েস্ট" : "Total requests",
      [countLbl]: requests.length,
    },
    {
      [metric]: lang === "bn" ? "মোট কন্টাক্ট" : "Total contacts",
      [countLbl]: flat.length,
    },
    {
      [metric]: lang === "bn" ? "কমিউনিটি থেকে" : "From community",
      [countLbl]: community,
    },
    {
      [metric]: lang === "bn" ? "এক্সপোর্ট কলাম (রিকোয়েস্ট)" : "Request columns exported",
      [countLbl]: columns.length,
    },
    ...Object.entries(byStatus)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({
        [metric]: `${lang === "bn" ? "স্ট্যাটাস" : "Status"}: ${k}`,
        [countLbl]: v,
      })),
    ...Object.entries(byUrgency)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({
        [metric]: `${lang === "bn" ? "জরুরি" : "Urgency"}: ${k}`,
        [countLbl]: v,
      })),
    ...Object.entries(byGroup)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({
        [metric]: `${lang === "bn" ? "রক্তের গ্রুপ" : "Blood group"}: ${k}`,
        [countLbl]: v,
      })),
    ...Object.entries(byCity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([k, v]) => ({
        [metric]: `${lang === "bn" ? "শহর" : "City"}: ${k}`,
        [countLbl]: v,
      })),
  ];
}

export function exportRequestsCsv(
  requests: RequestExportRow[],
  contactsByReq: Record<string, CommunityRequestContact[]>,
  lang: ExportLang = "bn",
): { filename: string; count: number; contactsFilename?: string } {
  const columns = collectRequestColumns(requests);
  const reqRows = requests.map((r) =>
    requestRecord(r, columns, contactsByReq[r.id] ?? [], lang),
  );
  const headers = columns.map((k) => labelOf(REQUEST_LABELS, k, lang));

  const flat = flattenContacts(requests, contactsByReq);
  const contactCols = collectContactColumns(flat);
  const contactRows = flat.map((c) => contactRecord(c, contactCols));
  const contactHeaders = contactCols.map((k) => labelOf(CONTACT_LABELS, k, lang));

  const ts = stamp();
  const filename = `bloodlink_requests_${ts}.csv`;
  downloadBlob(csvBlob(buildCsvTable(headers, columns, reqRows)), filename);

  let contactsFilename: string | undefined;
  if (contactRows.length > 0) {
    contactsFilename = `bloodlink_request_contacts_${ts}.csv`;
    window.setTimeout(() => {
      downloadBlob(
        csvBlob(buildCsvTable(contactHeaders, contactCols, contactRows)),
        contactsFilename!,
      );
    }, 350);
  }

  return { filename, contactsFilename, count: requests.length };
}

export async function exportRequestsExcel(
  requests: RequestExportRow[],
  contactsByReq: Record<string, CommunityRequestContact[]>,
  lang: ExportLang = "bn",
): Promise<{ filename: string; count: number }> {
  const XLSX = await import("xlsx");

  const columns = collectRequestColumns(requests);
  const reqRows = labeledRows(
    requests.map((r) => requestRecord(r, columns, contactsByReq[r.id] ?? [], lang)),
    columns,
    REQUEST_LABELS,
    lang,
  );

  const flat = flattenContacts(requests, contactsByReq);
  const contactCols = collectContactColumns(flat);
  const contactRows = labeledRows(
    flat.map((c) => contactRecord(c, contactCols)),
    contactCols,
    CONTACT_LABELS,
    lang,
  );

  const summary = buildSummaryRows(requests, contactsByReq, lang);

  const wb = XLSX.utils.book_new();

  // Requests FIRST so opening the file shows full post data, not only counts
  const wsReq = XLSX.utils.json_to_sheet(
    reqRows.length
      ? reqRows
      : [
          Object.fromEntries(
            columns.map((k) => [labelOf(REQUEST_LABELS, k, lang), ""]),
          ),
        ],
  );
  wsReq["!cols"] = columns.map((k) => ({
    wch: Math.min(48, Math.max(14, labelOf(REQUEST_LABELS, k, lang).length + 2)),
  }));

  const wsCon = XLSX.utils.json_to_sheet(
    contactRows.length
      ? contactRows
      : [
          Object.fromEntries(
            contactCols.map((k) => [labelOf(CONTACT_LABELS, k, lang), ""]),
          ),
        ],
  );
  wsCon["!cols"] = contactCols.map((k) => ({
    wch: Math.min(36, Math.max(12, labelOf(CONTACT_LABELS, k, lang).length + 2)),
  }));

  const wsSummary = XLSX.utils.json_to_sheet(summary);
  wsSummary["!cols"] = [{ wch: 36 }, { wch: 14 }];

  // ASCII sheet names — reliable across Excel / LibreOffice / Google Sheets
  XLSX.utils.book_append_sheet(wb, wsReq, "Requests");
  XLSX.utils.book_append_sheet(wb, wsCon, "Contacts");
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  const filename = `bloodlink_requests_${stamp()}.xlsx`;
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename,
  );
  return { filename, count: requests.length };
}

/** Summary-only Excel (counts by status, urgency, blood group, city). */
export async function exportRequestsSummaryExcel(
  requests: RequestExportRow[],
  contactsByReq: Record<string, CommunityRequestContact[]>,
  lang: ExportLang = "bn",
): Promise<{ filename: string; count: number }> {
  const XLSX = await import("xlsx");
  const summary = buildSummaryRows(requests, contactsByReq, lang);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(summary);
  ws["!cols"] = [{ wch: 40 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, "Summary");

  const filename = `bloodlink_requests_summary_${stamp()}.xlsx`;
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename,
  );
  return { filename, count: requests.length };
}

export function exportRequestsSql(
  requests: RequestExportRow[],
  contactsByReq: Record<string, CommunityRequestContact[]>,
  lang: ExportLang = "bn",
): { filename: string; count: number } {
  const contacts = flattenContacts(requests, contactsByReq);
  const lines: string[] = [sqlComment(lang, requests.length, contacts.length), "BEGIN;", ""];

  lines.push("-- —— public.blood_requests (all columns present on each row) ——");

  for (const r of requests) {
    const cols = Object.keys(r).filter((k) => k !== "contacts_count" && k !== "contacted_donors");
    if (!cols.length) continue;
    const values = cols.map((k) => {
      const v = r[k];
      if (k === "created_at" || k === "updated_at" || k === "needed_by" || k.endsWith("_at")) {
        if (v == null || v === "") return "NULL";
        // needed_by is often a date; others timestamptz
        if (k === "needed_by") return `${sqlLiteral(v)}::date`;
        return `${sqlLiteral(v)}::timestamptz`;
      }
      return sqlLiteral(v);
    });
    lines.push(
      [
        `INSERT INTO public.blood_requests (${cols.join(", ")})`,
        `VALUES (${values.join(", ")})`,
        "ON CONFLICT (id) DO NOTHING;",
        "",
      ].join("\n"),
    );
  }

  if (contacts.length) {
    lines.push("-- —— public.community_request_contacts ——");
    for (const c of contacts) {
      const raw = { ...c } as Record<string, unknown>;
      delete raw.patient_name;
      delete raw.blood_group;
      const cols = Object.keys(raw);
      const values = cols.map((k) => {
        const v = raw[k];
        if (k === "channel" && v != null) {
          return `${sqlLiteral(v)}::public.community_contact_channel`;
        }
        if (k === "created_at" || k === "updated_at" || k === "donated_at") {
          if (v == null || v === "") return "NULL";
          return `${sqlLiteral(v)}::timestamptz`;
        }
        return sqlLiteral(v);
      });
      lines.push(
        [
          `INSERT INTO public.community_request_contacts (${cols.join(", ")})`,
          `VALUES (${values.join(", ")})`,
          "ON CONFLICT (id) DO NOTHING;",
          "",
        ].join("\n"),
      );
    }
  }

  lines.push("COMMIT;", "");
  const filename = `bloodlink_requests_${stamp()}.sql`;
  downloadBlob(
    new Blob([lines.join("\n")], { type: "application/sql;charset=utf-8" }),
    filename,
  );
  return { filename, count: requests.length };
}
