import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { useI18n } from "@/lib/i18n";
import type { District } from "@/lib/api";
import {
  createAmbulanceRequest,
  fetchAmbulanceFareBreakdown,
  fetchListedAmbulanceProviders,
  type CreateAmbulanceRequestPayload,
} from "@/lib/ambulance-api";
import { CareLabPriceDisplay } from "@/components/care/CareLabPriceDisplay";
import type { AmbulanceFareBreakdown } from "@/lib/ambulance-price";
import { fetchAmbulanceFormFields, fetchAmbulanceServiceTypes } from "@/lib/ambulance-cms";
import { fetchAmbulanceSettings } from "@/lib/ambulance-settings";

type Props = {
  initialMode?: "emergency" | "scheduled";
  orgId?: string;
};

export function AmbulanceRequestPage({ initialMode = "emergency", orgId }: Props) {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"emergency" | "scheduled">(initialMode);
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof fetchAmbulanceSettings>> | null>(null);
  const [fields, setFields] = useState<Awaited<ReturnType<typeof fetchAmbulanceFormFields>>>([]);
  const [types, setTypes] = useState<Awaited<ReturnType<typeof fetchAmbulanceServiceTypes>>>([]);
  const [providers, setProviders] = useState<{ id: string; name: string; name_bn: string | null }[]>([]);
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [selectedOrg, setSelectedOrg] = useState(orgId ?? "");
  const [pickupDistrict, setPickupDistrict] = useState<District | null>(null);
  const [pickupUpazila, setPickupUpazila] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [patientCondition, setPatientCondition] = useState("");
  const [notes, setNotes] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [distanceKm, setDistanceKm] = useState("5");
  const [estimate, setEstimate] = useState<AmbulanceFareBreakdown | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([fetchAmbulanceSettings(), fetchAmbulanceFormFields(), fetchAmbulanceServiceTypes(), fetchListedAmbulanceProviders()]).then(
      ([s, f, t, p]) => {
        setSettings(s);
        setFields(f.filter((x) => x.is_enabled));
        setTypes(t.filter((x) => x.is_active));
        setProviders(p as { id: string; name: string; name_bn: string | null }[]);
        if (t[0]) setServiceTypeId(t[0].id);
        if (orgId) setSelectedOrg(orgId);
        else if (p[0]) setSelectedOrg(String((p[0] as { id: string }).id));
      },
    );
  }, [orgId]);

  useEffect(() => {
    if (selectedOrg && serviceTypeId) {
      void fetchAmbulanceFareBreakdown(selectedOrg, serviceTypeId, Number(distanceKm) || 5).then(setEstimate);
    } else setEstimate(null);
  }, [selectedOrg, serviceTypeId, distanceKm]);

  async function submit() {
    setBusy(true);
    try {
      const payload: CreateAmbulanceRequestPayload = {
        mode,
        org_id: selectedOrg || undefined,
        service_type_id: serviceTypeId || undefined,
        scheduled_at: mode === "scheduled" && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        guest_name: guestName || undefined,
        guest_phone: guestPhone || undefined,
        pickup_address: pickupAddress || undefined,
        pickup_district_id: pickupDistrict?.id,
        pickup_upazila: pickupUpazila || undefined,
        dropoff_address: dropoffAddress || undefined,
        patient_condition: patientCondition || undefined,
        notes: notes || undefined,
        distance_km: Number(distanceKm) || 5,
        source: "app",
      };
      const req = await createAmbulanceRequest(payload);
      toast.success(lang === "bn" ? `রেফ ${req.reference_code}` : `Ref ${req.reference_code}`);
      void navigate({ to: "/ambulance/request/$id", params: { id: req.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const show = (key: string) => fields.some((f) => f.field_key === key);
  const required = (key: string) => fields.find((f) => f.field_key === key)?.is_required;

  return (
    <div className="w-full">
      <AutoHideHeader className="z-30 border-b bg-background safe-top">
        <div className="flex items-center gap-2 px-3 py-2">
          <PageBackButton fallbackTo="/ambulance" shape="xl" />
          <h1 className="text-sm font-bold">{lang === "bn" ? "অ্যাম্বুলেন্স রিকোয়েস্ট" : "Ambulance request"}</h1>
        </div>
      </AutoHideHeader>
      <div className="px-3 py-4 max-w-lg mx-auto space-y-4">
        {settings?.features.emergency_enabled && settings?.features.scheduled_enabled && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode("emergency")} className={`flex-1 rounded-xl py-2 text-xs font-semibold ${mode === "emergency" ? "bg-red-600 text-white" : "border"}`}>
              {lang === "bn" ? "জরুরি" : "Emergency"}
            </button>
            <button type="button" onClick={() => setMode("scheduled")} className={`flex-1 rounded-xl py-2 text-xs font-semibold ${mode === "scheduled" ? "bg-primary text-primary-foreground" : "border"}`}>
              {lang === "bn" ? "শিডিউল" : "Scheduled"}
            </button>
          </div>
        )}
        {mode === "scheduled" && (
          <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm" />
        )}
        <select value={serviceTypeId} onChange={(e) => setServiceTypeId(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm">
          {types.map((t) => (
            <option key={t.id} value={t.id}>{lang === "bn" ? t.name_bn : t.name_en}</option>
          ))}
        </select>
        {!orgId && (
          <select value={selectedOrg} onChange={(e) => setSelectedOrg(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm">
            <option value="">{lang === "bn" ? "নিকটতম (পুল)" : "Nearest pool"}</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{lang === "bn" ? p.name_bn || p.name : p.name}</option>
            ))}
          </select>
        )}
        <DistrictTypeahead value={pickupDistrict} onChange={setPickupDistrict} placeholder={lang === "bn" ? "Pickup জেলা" : "Pickup district"} />
        {show("pickup_address") && (
          <input value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} placeholder={lang === "bn" ? "Pickup ঠিকানা" : "Pickup address"} required={required("pickup_address")} className="w-full rounded-xl border px-3 py-2 text-sm" />
        )}
        {show("dropoff_address") && (
          <input value={dropoffAddress} onChange={(e) => setDropoffAddress(e.target.value)} placeholder={lang === "bn" ? "গন্তব্য" : "Dropoff"} className="w-full rounded-xl border px-3 py-2 text-sm" />
        )}
        <input value={pickupUpazila} onChange={(e) => setPickupUpazila(e.target.value)} placeholder={lang === "bn" ? "উপজেলা" : "Upazila"} className="w-full rounded-xl border px-3 py-2 text-sm" />
        {show("patient_name") && (
          <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder={lang === "bn" ? "রোগীর নাম" : "Patient name"} required={required("patient_name")} className="w-full rounded-xl border px-3 py-2 text-sm" />
        )}
        {show("patient_phone") && (
          <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder={lang === "bn" ? "ফোন" : "Phone"} required={required("patient_phone")} className="w-full rounded-xl border px-3 py-2 text-sm" />
        )}
        {show("patient_condition") && (
          <textarea value={patientCondition} onChange={(e) => setPatientCondition(e.target.value)} placeholder={lang === "bn" ? "অবস্থা" : "Condition"} className="w-full rounded-xl border px-3 py-2 text-sm min-h-20" />
        )}
        {show("notes") && (
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={lang === "bn" ? "নোট" : "Notes"} className="w-full rounded-xl border px-3 py-2 text-sm min-h-16" />
        )}
        <input type="number" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} placeholder={lang === "bn" ? "দূরত্ব (কিমি)" : "Distance km"} className="w-full rounded-xl border px-3 py-2 text-sm" />
        {estimate != null && (
          <div className="rounded-2xl border bg-orange-50/60 border-orange-100 px-4 py-3 text-center space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-orange-800/70">
              {lang === "bn" ? "আনুমানিক ভাড়া" : "Estimated fare"}
            </p>
            <div className="flex justify-center">
              <CareLabPriceDisplay
                listPrice={estimate.list_fare}
                salePrice={estimate.sale_fare}
                discountPercent={estimate.discount_percent}
                lang={lang}
                variant="card"
              />
            </div>
            {estimate.saved > 0 && (
              <p className="text-[11px] text-emerald-700">
                {lang === "bn" ? "সাশ্রয়" : "You save"} ৳{estimate.saved}
              </p>
            )}
          </div>
        )}
        <button type="button" disabled={busy} onClick={() => void submit()} className="w-full rounded-xl bg-orange-600 text-white py-3 text-sm font-bold disabled:opacity-60">
          {busy ? (lang === "bn" ? "পাঠানো…" : "Submitting…") : lang === "bn" ? "রিকোয়েস্ট পাঠান" : "Submit request"}
        </button>
      </div>
    </div>
  );
}
