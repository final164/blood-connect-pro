import { useEffect, useMemo, useState } from "react";
import { MessageSquare, X, ChevronRight, ChevronLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { BLOOD_GROUPS } from "@/lib/format";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { UpazilaSelect } from "@/components/district/UpazilaSelect";
import type { District } from "@/lib/api";
import type { CommunityDonorRow } from "@/lib/community-donor-import";
import {
  contactFlagsForViewerDonor,
  normalizeDonorContactSettings,
  type DonorContactSettings,
} from "@/lib/community-contact-settings";
import {
  applySmsTemplate,
  buildSmsHref,
  fetchMessagingSettings,
  type MessagingSettings,
} from "@/lib/messaging-settings";
import { toast } from "sonner";

export type CommunitySmsDraft = {
  patient_name: string;
  blood_group: (typeof BLOOD_GROUPS)[number];
  bags_needed: number;
  hospital: string;
  district: District | null;
  upazila: string;
  contact: string;
  urgency: "normal" | "urgent" | "critical";
  notes: string;
};

const emptyDraft = (district: District | null): CommunitySmsDraft => ({
  patient_name: "",
  blood_group: "O+",
  bags_needed: 1,
  hospital: "",
  district,
  upazila: "",
  contact: "",
  urgency: "normal",
  notes: "",
});

function orgSettings(d: CommunityDonorRow): DonorContactSettings {
  const raw = (d.community_orgs as { donor_contact_settings?: unknown } | null | undefined)
    ?.donor_contact_settings;
  return normalizeDonorContactSettings(raw);
}

export function CommunitySendSmsSheet({
  open,
  onClose,
  donors,
  defaultDistrict,
  defaultUpazila,
  viewerGender,
}: {
  open: boolean;
  onClose: () => void;
  donors: CommunityDonorRow[];
  defaultDistrict: District | null;
  defaultUpazila: string;
  viewerGender?: string | null;
}) {
  const { lang } = useI18n();
  const [step, setStep] = useState<1 | 2>(1);
  const [draft, setDraft] = useState<CommunitySmsDraft>(() => emptyDraft(defaultDistrict));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msgSettings, setMsgSettings] = useState<MessagingSettings | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setDraft({
      ...emptyDraft(defaultDistrict),
      upazila: defaultUpazila,
    });
    setSelected(new Set());
    void fetchMessagingSettings().then(setMsgSettings);
  }, [open, defaultDistrict, defaultUpazila]);

  const smsEligible = useMemo(
    () =>
      donors.filter((d) => {
        const flags = contactFlagsForViewerDonor(orgSettings(d), viewerGender, d.gender);
        return flags.sms && d.phone?.trim();
      }),
    [donors, viewerGender],
  );

  const field =
    "w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/25";

  function goSelect() {
    if (!draft.patient_name.trim()) {
      return toast.error(lang === "bn" ? "রোগীর নাম দিন" : "Enter patient name");
    }
    if (!draft.hospital.trim()) {
      return toast.error(lang === "bn" ? "হাসপাতালের নাম দিন" : "Enter hospital name");
    }
    if (!draft.district) {
      return toast.error(lang === "bn" ? "জেলা সিলেক্ট করুন" : "Select a district");
    }
    if (!smsEligible.length) {
      return toast.error(
        lang === "bn"
          ? "এই ফিল্টারে SMS পাঠানোর যোগ্য কোনো রক্তদাতা নেই"
          : "No SMS-eligible donors in this filter",
      );
    }
    setStep(2);
  }

  function buildBody(): string {
    const s = msgSettings;
    const tpl =
      lang === "bn"
        ? s?.community_sms_bn ?? ""
        : s?.community_sms_en ?? "";
    const link = typeof window !== "undefined" ? window.location.origin : "";
    const distName =
      draft.district && (lang === "bn" ? draft.district.name_bn : draft.district.name_en);
    return applySmsTemplate(tpl, {
      blood_group: draft.blood_group,
      patient_name: draft.patient_name.trim(),
      hospital: draft.hospital.trim(),
      upazila: draft.upazila.trim(),
      district: distName,
      bags: draft.bags_needed,
      urgency: draft.urgency,
      contact: draft.contact.trim(),
      notes: draft.notes.trim(),
      link,
      location: [draft.hospital.trim(), draft.upazila.trim(), distName].filter(Boolean).join(" · "),
    });
  }

  function send() {
    const picks = smsEligible.filter((d) => selected.has(d.id));
    if (!picks.length) {
      return toast.error(lang === "bn" ? "কমপক্ষে একজন সিলেক্ট করুন" : "Select at least one donor");
    }
    const href = buildSmsHref(
      picks.map((d) => d.phone),
      buildBody(),
    );
    if (!href) return toast.error(lang === "bn" ? "ফোন নম্বর নেই" : "No phone numbers");
    window.location.href = href;
    onClose();
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === smsEligible.length) setSelected(new Set());
    else setSelected(new Set(smsEligible.map((d) => d.id)));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-lg max-h-[92vh] overflow-auto rounded-t-2xl sm:rounded-2xl border bg-card shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-card/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare className="h-4 w-4 text-primary shrink-0" />
            <h2 className="text-sm font-semibold truncate">
              {step === 1
                ? lang === "bn"
                  ? "SMS — রিকোয়েস্ট ফর্ম"
                  : "SMS — request form"
                : lang === "bn"
                  ? "প্রাপক সিলেক্ট"
                  : "Select recipients"}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-muted grid place-items-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 1 ? (
          <div className="p-4 space-y-3">
            <input
              className={field}
              placeholder={lang === "bn" ? "রোগীর নাম *" : "Patient name *"}
              value={draft.patient_name}
              onChange={(e) => setDraft({ ...draft, patient_name: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                className={field}
                value={draft.blood_group}
                onChange={(e) =>
                  setDraft({ ...draft, blood_group: e.target.value as (typeof BLOOD_GROUPS)[number] })
                }
              >
                {BLOOD_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <input
                className={field}
                type="number"
                min={1}
                value={draft.bags_needed}
                onChange={(e) =>
                  setDraft({ ...draft, bags_needed: Math.max(1, Number(e.target.value) || 1) })
                }
                placeholder={lang === "bn" ? "ব্যাগ" : "Bags"}
              />
            </div>
            <input
              className={field}
              placeholder={lang === "bn" ? "হাসপাতাল *" : "Hospital *"}
              value={draft.hospital}
              onChange={(e) => setDraft({ ...draft, hospital: e.target.value })}
            />
            <DistrictTypeahead
              value={draft.district}
              onChange={(d) => setDraft({ ...draft, district: d, upazila: "" })}
              placeholder={lang === "bn" ? "জেলা *" : "District *"}
            />
            <UpazilaSelect
              district={draft.district}
              value={draft.upazila}
              onChange={(v) => setDraft({ ...draft, upazila: v })}
            />
            <input
              className={field}
              placeholder={lang === "bn" ? "যোগাযোগ নম্বর" : "Contact phone"}
              value={draft.contact}
              onChange={(e) => setDraft({ ...draft, contact: e.target.value })}
              inputMode="tel"
            />
            <div className="grid grid-cols-3 gap-1.5">
              {(["normal", "urgent", "critical"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setDraft({ ...draft, urgency: u })}
                  className={`rounded-xl py-2 text-xs font-semibold border ${
                    draft.urgency === u
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
            <textarea
              className={`${field} min-h-[72px] resize-y`}
              placeholder={lang === "bn" ? "নোট (ঐচ্ছিক)" : "Notes (optional)"}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
            <button
              type="button"
              onClick={goSelect}
              className="w-full rounded-xl bg-primary text-primary-foreground text-sm font-semibold py-3 flex items-center justify-center gap-1"
            >
              {lang === "bn" ? "পরবর্তী — প্রাপক বাছুন" : "Next — pick recipients"}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <button type="button" onClick={() => setStep(1)} className="flex items-center gap-1 hover:text-foreground">
                <ChevronLeft className="h-3.5 w-3.5" />
                {lang === "bn" ? "ফর্ম" : "Form"}
              </button>
              <button type="button" onClick={toggleAll} className="text-primary font-medium">
                {selected.size === smsEligible.length
                  ? lang === "bn"
                    ? "সব সরান"
                    : "Clear all"
                  : lang === "bn"
                    ? "সব সিলেক্ট"
                    : "Select all"}
              </button>
            </div>
            <ul className="max-h-[50vh] overflow-auto space-y-1.5 rounded-xl border p-2">
              {smsEligible.map((d) => (
                <li key={d.id}>
                  <label className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(d.id)}
                      onChange={() => toggle(d.id)}
                      className="h-4 w-4 accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{d.full_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {d.blood_group || "—"} · {d.phone}
                        {d.gender
                          ? ` · ${d.gender === "male" ? (lang === "bn" ? "পুরুষ" : "Male") : lang === "bn" ? "মহিলা" : "Female"}`
                          : ""}
                      </p>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-muted-foreground">
              {lang === "bn"
                ? `${selected.size} জন সিলেক্ট — ফোনের SMS অ্যাপে যাবে (ওয়েবসাইট লিঙ্কসহ)`
                : `${selected.size} selected — opens phone SMS with website link`}
            </p>
            <button
              type="button"
              onClick={send}
              disabled={!selected.size}
              className="w-full rounded-xl bg-primary text-primary-foreground text-sm font-semibold py-3 disabled:opacity-50"
            >
              {lang === "bn" ? "SMS পাঠান" : "Open SMS"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
