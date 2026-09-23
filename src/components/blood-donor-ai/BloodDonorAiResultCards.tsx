import { Building2, Copy, MessageSquare, Phone, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import type { BloodDonorAiToolResults, BloodDonorAiDonorCard } from "@/lib/blood-donor-ai-chat";
import type { BloodDonorAiPublicConfig } from "@/lib/blood-donor-ai-settings";
import { buildSmsHref } from "@/lib/messaging-settings";
import { whatsappHref } from "@/lib/request-form-options";

function donorMetaLine(
  d: BloodDonorAiDonorCard,
  fields: BloodDonorAiPublicConfig["list_fields"],
  bn: boolean,
) {
  const parts: string[] = [];
  if (fields.blood_group) parts.push(d.blood_group ?? "?");
  if (fields.gender && d.gender) parts.push(d.gender);
  if (fields.upazila && d.upazila) parts.push(d.upazila);
  if (fields.district && d.district) parts.push(d.district);
  if (fields.source) {
    parts.push(d.source === "app" ? (bn ? "অ্যাপ" : "app") : bn ? "সংগঠন" : "org");
  }
  return parts.join(" · ");
}

function donorCopyLine(
  d: BloodDonorAiDonorCard,
  fields: BloodDonorAiPublicConfig["list_fields"],
  bn: boolean,
) {
  const parts: string[] = [];
  if (fields.name) parts.push(d.name);
  if (fields.blood_group) parts.push(d.blood_group ?? "?");
  // Donor phones are never copied from AI — Community only
  if (fields.gender && d.gender) parts.push(d.gender);
  if (fields.upazila && d.upazila) parts.push(d.upazila);
  if (fields.district && d.district) parts.push(d.district);
  if (fields.source) {
    parts.push(d.source === "app" ? (bn ? "অ্যাপ" : "app") : bn ? "সংগঠন" : "org");
  }
  return parts.join(" · ");
}

function communitySearchFromResults(results: BloodDonorAiToolResults) {
  const search: {
    district?: string;
    upazila?: string;
    blood?: string;
  } = {};
  if (results.district_slug) search.district = results.district_slug;
  else if (results.district_label) search.district = results.district_label;
  if (results.upazila_label) search.upazila = results.upazila_label;
  if (results.blood_group) search.blood = results.blood_group;
  return search;
}

export function BloodDonorAiResultCards({
  results,
  cfg,
  lang,
  loggedIn,
  onNeedLogin,
}: {
  results: BloodDonorAiToolResults;
  cfg: BloodDonorAiPublicConfig;
  lang: "bn" | "en";
  loggedIn: boolean;
  onNeedLogin: () => void;
}) {
  const bn = lang === "bn";
  const fields = { ...cfg.list_fields, phone: false };
  const orgPhones = results.orgs.map((o) => o.phone).filter(Boolean) as string[];
  const communitySearch = communitySearchFromResults(results);

  function requireAuth(action: () => void) {
    if (!loggedIn) {
      onNeedLogin();
      return;
    }
    action();
  }

  function openOrgSms() {
    requireAuth(() => {
      if (!cfg.actions.open_sms || !orgPhones.length) {
        toast.error(
          bn
            ? "সংগঠনের নম্বর নেই — Community তে ডোনার দেখুন"
            : "No org numbers — view donors in Community",
        );
        return;
      }
      const href = buildSmsHref(orgPhones.slice(0, cfg.filters.max_donors), results.sms_body);
      if (!href) return;
      window.location.href = href;
    });
  }

  function openOrgWhatsApp() {
    requireAuth(() => {
      if (!cfg.actions.open_whatsapp || !orgPhones.length) {
        toast.error(bn ? "সংগঠনের নম্বর নেই" : "No org numbers");
        return;
      }
      const first = orgPhones[0]!;
      const base = whatsappHref(first);
      if (!base) return;
      const sep = base.includes("?") ? "&" : "?";
      window.open(
        `${base}${sep}text=${encodeURIComponent(results.sms_body)}`,
        "_blank",
        "noopener,noreferrer",
      );
    });
  }

  async function copyList() {
    if (!cfg.actions.copy_list) return;
    const lines = results.donors.map((d) => donorCopyLine(d, fields, bn));
    const orgLines = results.orgs
      .filter((o) => o.phone)
      .map((o) => `${o.name} · ${o.phone}`);
    const text = [
      `${results.blood_group} · ${results.district_label}${
        results.upazila_label ? ` · ${results.upazila_label}` : ""
      }`,
      ...(bn ? ["ডোনার (নম্বর Community তে):"] : ["Donors (phones in Community):"]),
      ...lines,
      ...(orgLines.length
        ? [bn ? "সংগঠন / কমিউনিটি:" : "Organizations:", ...orgLines]
        : []),
      "",
      results.sms_body,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success(bn ? "কপি হয়েছে" : "Copied");
    } catch {
      toast.error(bn ? "কপি ব্যর্থ" : "Copy failed");
    }
  }

  return (
    <div className="space-y-3 mt-2">
      <Link
        to="/community"
        search={communitySearch}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground"
      >
        <Users className="h-3.5 w-3.5" />
        {bn
          ? `Community তে ডোনার দেখুন (${results.donors.length})`
          : `View donors in Community (${results.donors.length})`}
      </Link>

      {(cfg.actions.open_sms || cfg.actions.open_whatsapp || cfg.actions.copy_list) && (
        <div className="flex flex-wrap gap-2">
          {cfg.actions.open_sms && (
            <button
              type="button"
              onClick={openOrgSms}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {bn ? "সংগঠনে SMS" : "SMS orgs"}
            </button>
          )}
          {cfg.actions.open_whatsapp && (
            <button
              type="button"
              onClick={openOrgWhatsApp}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"
            >
              <Phone className="h-3.5 w-3.5" />
              {bn ? "সংগঠন WhatsApp" : "Org WhatsApp"}
            </button>
          )}
          {cfg.actions.copy_list && (
            <button
              type="button"
              onClick={() => void copyList()}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"
            >
              <Copy className="h-3.5 w-3.5" />
              {bn ? "তালিকা কপি" : "Copy list"}
            </button>
          )}
        </div>
      )}

      {cfg.actions.show_list && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/40">
            <Users className="h-4 w-4 text-primary" />
            <p className="text-xs font-bold">
              {bn ? "ম্যাচড ডোনার" : "Matched donors"} · {results.donors.length}
              {cfg.filters.gender !== "any" ? ` · ${cfg.filters.gender}` : ""}
            </p>
          </div>
          <p className="px-3 py-1.5 text-[10px] text-muted-foreground border-b bg-muted/20">
            {bn
              ? "ফোন নম্বর এখানে দেখানো হয় না — Community তে খুলুন।"
              : "Phone numbers are hidden here — open Community."}
          </p>
          {results.donors.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground">
              {bn ? "কোনো উপলব্ধ ডোনার পাওয়া যায়নি" : "No available donors found"}
            </p>
          ) : (
            <ul className="divide-y max-h-64 overflow-y-auto">
              {results.donors.map((d) => {
                const meta = donorMetaLine(d, fields, bn);
                return (
                  <li key={d.id} className="px-3 py-2.5 text-xs">
                    <div className="min-w-0">
                      {fields.name ? (
                        <p className="font-semibold truncate">{d.name}</p>
                      ) : null}
                      {meta ? (
                        <p className="text-muted-foreground truncate">{meta}</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {cfg.actions.show_orgs && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/40">
            <Building2 className="h-4 w-4 text-primary" />
            <p className="text-xs font-bold">
              {bn ? "কমিউনিটি / সংগঠন" : "Community / Organizations"} · {results.orgs.length}
            </p>
          </div>
          {results.orgs.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground">
              {bn ? "এই এলাকায় কোনো সংগঠন পাওয়া যায়নি" : "No organizations found in this area"}
            </p>
          ) : (
            <ul className="divide-y max-h-48 overflow-y-auto">
              {results.orgs.map((o) => (
                <li key={o.id} className="px-3 py-2.5 text-xs flex justify-between gap-2">
                  <Link
                    to="/community"
                    search={{ orgId: o.id, ...communitySearch }}
                    className="font-semibold truncate text-foreground hover:text-primary"
                  >
                    {o.name}
                  </Link>
                  {o.phone ? (
                    <a href={`tel:${o.phone}`} className="font-mono text-primary shrink-0">
                      {o.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground shrink-0 text-[10px]">
                      {bn ? "নম্বর নেই" : "No phone"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
