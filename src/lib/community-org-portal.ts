import { supabase } from "@/integrations/supabase/client";

export type OrgPortalFaq = {
  id: string;
  question_bn: string;
  question_en: string;
  answer_bn: string;
  answer_en: string;
};

export type OrgPortalAdvanced = {
  show_donor_count_public: boolean;
  show_open_requests_public: boolean;
  show_phone_public: boolean;
  highlight_verified_badge: boolean;
  accept_inbound_requests: boolean;
  notify_members_on_request: boolean;
  welcome_bn: string;
  welcome_en: string;
};

export type OrgPortalContent = {
  about_bn: string;
  about_en: string;
  faqs: OrgPortalFaq[];
  advanced: OrgPortalAdvanced;
};

export const DEFAULT_ORG_PORTAL_ADVANCED: OrgPortalAdvanced = {
  show_donor_count_public: true,
  show_open_requests_public: true,
  show_phone_public: true,
  highlight_verified_badge: true,
  accept_inbound_requests: true,
  notify_members_on_request: false,
  welcome_bn: "",
  welcome_en: "",
};

export const DEFAULT_ORG_PORTAL_CONTENT: OrgPortalContent = {
  about_bn: "",
  about_en: "",
  faqs: [],
  advanced: { ...DEFAULT_ORG_PORTAL_ADVANCED },
};

export function newOrgFaq(): OrgPortalFaq {
  return {
    id: crypto.randomUUID(),
    question_bn: "",
    question_en: "",
    answer_bn: "",
    answer_en: "",
  };
}

export function parseOrgPortalContent(raw: unknown): OrgPortalContent {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<OrgPortalContent> & {
    advanced?: Partial<OrgPortalAdvanced>;
    faqs?: unknown;
  };
  const faqs: OrgPortalFaq[] = [];
  if (Array.isArray(r.faqs)) {
    for (const row of r.faqs) {
      if (!row || typeof row !== "object") continue;
      const f = row as Partial<OrgPortalFaq>;
      faqs.push({
        id: typeof f.id === "string" && f.id ? f.id : crypto.randomUUID(),
        question_bn: String(f.question_bn ?? ""),
        question_en: String(f.question_en ?? ""),
        answer_bn: String(f.answer_bn ?? ""),
        answer_en: String(f.answer_en ?? ""),
      });
    }
  }
  const a = r.advanced ?? {};
  return {
    about_bn: typeof r.about_bn === "string" ? r.about_bn : "",
    about_en: typeof r.about_en === "string" ? r.about_en : "",
    faqs,
    advanced: {
      show_donor_count_public: a.show_donor_count_public !== false,
      show_open_requests_public: a.show_open_requests_public !== false,
      show_phone_public: a.show_phone_public !== false,
      highlight_verified_badge: a.highlight_verified_badge !== false,
      accept_inbound_requests: a.accept_inbound_requests !== false,
      notify_members_on_request: a.notify_members_on_request === true,
      welcome_bn: typeof a.welcome_bn === "string" ? a.welcome_bn : "",
      welcome_en: typeof a.welcome_en === "string" ? a.welcome_en : "",
    },
  };
}

export async function saveOrgPortalContent(orgId: string, content: OrgPortalContent) {
  const normalized = parseOrgPortalContent(content);
  const { error } = await supabase
    .from("community_orgs")
    .update({
      portal_content: normalized,
      description: normalized.about_en || null,
      description_bn: normalized.about_bn || null,
    } as never)
    .eq("id", orgId);
  if (error) {
    // Fallback if portal_content column not migrated yet — still save about into description
    if (/portal_content/i.test(error.message)) {
      const { error: e2 } = await supabase
        .from("community_orgs")
        .update({
          description: normalized.about_en || null,
          description_bn: normalized.about_bn || null,
        })
        .eq("id", orgId);
      if (e2) throw new Error(e2.message);
      throw new Error(
        "FAQ/advanced need portal_content column — apply migration 20261019090000_community_org_portal_content.sql",
      );
    }
    throw new Error(error.message);
  }
  return normalized;
}
