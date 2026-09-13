import { Building2, Copy, MessageSquare, Phone, Users } from "lucide-react";
import { toast } from "sonner";
import type { BloodDonorAiToolResults, BloodDonorAiDonorCard } from "@/lib/blood-donor-ai-chat";
import type { BloodDonorAiPublicConfig } from "@/lib/blood-donor-ai-settings";
import { buildSmsHref } from "@/lib/messaging-settings";
import { whatsappHref } from "@/lib/request-form-options";
import { authWithNext } from "@/lib/auth-next";

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
  if (fields.phone) parts.push(d.phone);
  if (fields.gender && d.gender) parts.push(d.gender);
  if (fields.upazila && d.upazila) parts.push(d.upazila);
  if (fields.district && d.district) parts.push(d.district);
  if (fields.source) {
    parts.push(d.source === "app" ? (bn ? "অ্যাপ" : "app") : bn ? "সংগঠন" : "org");
  }
  return parts.join(" · ");
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
  const fields = cfg.list_fields;
  const phones = fields.phone
    ? results.donors.map((d) => d.phone).filter(Boolean)
    : [];

  function requireAuth(action: () => void) {
    if (!loggedIn) {
      onNeedLogin();
      return;
    }
    action();
  }

  function openSms() {
    requireAuth(() => {
      if (!cfg.actions.open_sms || !phones.length) {
        toast.error(bn ? "পাঠানোর নম্বর নেই" : "No phone numbers");
        return;
      }
      const href = buildSmsHref(phones.slice(0, cfg.filters.max_donors), results.sms_body);
      if (!href) return;
      window.location.href = href;
    });
  }

  function openWhatsApp() {
    requireAuth(() => {
      if (!cfg.actions.open_whatsapp || !phones.length) {
        toast.error(bn ? "নম্বর নেই" : "No numbers");
        return;
      }
      const first = phones[0]!;
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
    const text = [
      `${results.blood_group} · ${results.district_label}`,
      ...lines,
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
      {(cfg.actions.open_sms || cfg.actions.open_whatsapp || cfg.actions.copy_list) && (
        <div className="flex flex-wrap gap-2">
          {cfg.actions.open_sms && (
            <button
              type="button"
              onClick={openSms}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {bn ? "SMS পাঠান" : "Send SMS"}
            </button>
          )}
          {cfg.actions.open_whatsapp && (
            <button
              type="button"
              onClick={openWhatsApp}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"
            >
              <Phone className="h-3.5 w-3.5" />
              WhatsApp
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
              {bn ? "উপলব্ধ ডোনার" : "Available donors"} · {results.donors.length}
              {cfg.filters.gender !== "any" ? ` · ${cfg.filters.gender}` : ""}
            </p>
          </div>
          {results.donors.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground">
              {bn ? "কোনো উপলব্ধ ডোনার পাওয়া যায়নি" : "No available donors found"}
            </p>
          ) : (
            <ul className="divide-y max-h-64 overflow-y-auto">
              {results.donors.map((d) => {
                const meta = donorMetaLine(d, fields, bn);
                return (
                  <li
                    key={d.id}
                    className="px-3 py-2.5 text-xs flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      {fields.name ? (
                        <p className="font-semibold truncate">{d.name}</p>
                      ) : null}
                      {meta ? (
                        <p className="text-muted-foreground truncate">{meta}</p>
                      ) : null}
                    </div>
                    {fields.phone ? (
                      <a
                        href={loggedIn ? `tel:${d.phone}` : authWithNext("/ai/donors")}
                        onClick={(e) => {
                          if (!loggedIn) {
                            e.preventDefault();
                            onNeedLogin();
                          }
                        }}
                        className="shrink-0 font-mono text-primary font-semibold"
                      >
                        {d.phone}
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {cfg.actions.show_orgs && results.orgs.length > 0 && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/40">
            <Building2 className="h-4 w-4 text-primary" />
            <p className="text-xs font-bold">
              {bn ? "সংগঠন" : "Organizations"} · {results.orgs.length}
            </p>
          </div>
          <ul className="divide-y max-h-48 overflow-y-auto">
            {results.orgs.map((o) => (
              <li key={o.id} className="px-3 py-2.5 text-xs flex justify-between gap-2">
                <span className="font-semibold truncate">{o.name}</span>
                {o.phone ? (
                  <a href={`tel:${o.phone}`} className="font-mono text-primary shrink-0">
                    {o.phone}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
