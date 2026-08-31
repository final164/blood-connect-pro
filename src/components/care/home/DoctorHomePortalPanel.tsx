import { useEffect, useState } from "react";
import { Home, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { UpazilaSelect } from "@/components/district/UpazilaSelect";
import type { District } from "@/lib/api";
import { formatCareMoney } from "@/lib/care-invoice";
import {
  fetchDoctorHomeQueue,
  fetchHomeDoctorAreas,
  fetchMyHomeDoctorProfile,
  homeVisitStatusLabel,
  homeVisitStatusTone,
  joinHomeDoctor,
  setHomeDoctorAreas,
  setHomeDoctorOnline,
  setHomeVisitStatus,
  updateHomeDoctorProfile,
  type CareHomeDoctorArea,
  type CareHomeDoctorProfile,
  type CareHomeVisitBooking,
} from "@/lib/care-home-api";
import { HomeVisitScheduleEditor } from "@/components/care/home/HomeVisitScheduleEditor";
import { cn } from "@/lib/utils";

type AreaDraft = { district: District | null; upazila: string };

type Props = {
  doctorId: string;
  bn: boolean;
  lang: "bn" | "en";
};

export function DoctorHomePortalPanel({ doctorId, bn, lang }: Props) {
  const [profile, setProfile] = useState<CareHomeDoctorProfile | null>(null);
  const [areas, setAreas] = useState<CareHomeDoctorArea[]>([]);
  const [queue, setQueue] = useState<CareHomeVisitBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [busy, setBusy] = useState(false);

  const [draftAreas, setDraftAreas] = useState<AreaDraft[]>([{ district: null, upazila: "" }]);
  const [fee, setFee] = useState("500");
  const [aboutBn, setAboutBn] = useState("");
  const [aboutEn, setAboutEn] = useState("");
  const [visitMinutes, setVisitMinutes] = useState("30");

  async function reload() {
    const [p, a, q] = await Promise.all([
      fetchMyHomeDoctorProfile(doctorId),
      fetchHomeDoctorAreas(doctorId),
      fetchDoctorHomeQueue(doctorId),
    ]);
    setProfile(p);
    setAreas(a);
    setQueue(q);
    if (p) {
      setFee(String(p.fee_amount ?? 0));
      setAboutBn(p.about_bn ?? "");
      setAboutEn(p.about_en ?? "");
      setVisitMinutes(String(p.visit_minutes ?? 30));
    }
  }

  useEffect(() => {
    setLoading(true);
    void reload()
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoading(false));
  }, [doctorId]);

  async function handleJoin() {
    const areasPayload = draftAreas
      .filter((a) => a.district?.id)
      .map((a) => ({
        district_id: a.district!.id,
        upazila: a.upazila.trim() || null,
      }));
    if (!areasPayload.length) {
      toast.error(bn ? "অন্তত একটি এলাকা যোগ করুন" : "Add at least one area");
      return;
    }
    setJoining(true);
    try {
      await joinHomeDoctor({
        areas: areasPayload,
        feeAmount: Number(fee) || 0,
        aboutBn,
        aboutEn,
        visitMinutes: Number(visitMinutes) || 30,
      });
      toast.success(bn ? "হোম ডাক্তারে যোগ দিয়েছেন" : "Joined Home Doctor");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setJoining(false);
    }
  }

  async function saveAreas() {
    const areasPayload = draftAreas
      .filter((a) => a.district?.id)
      .map((a) => ({
        district_id: a.district!.id,
        upazila: a.upazila.trim() || null,
      }));
    if (!areasPayload.length) {
      toast.error(bn ? "অন্তত একটি এলাকা" : "Need at least one area");
      return;
    }
    setBusy(true);
    try {
      await setHomeDoctorAreas(areasPayload);
      toast.success(bn ? "এলাকা আপডেট হয়েছে" : "Areas updated");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    setBusy(true);
    try {
      await updateHomeDoctorProfile({
        feeAmount: Number(fee) || 0,
        aboutBn,
        aboutEn,
        visitMinutes: Number(visitMinutes) || 30,
      });
      toast.success(bn ? "প্রোফাইল সেভ" : "Profile saved");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleOnline() {
    if (!profile) return;
    setBusy(true);
    try {
      const next = await setHomeDoctorOnline(!profile.is_online);
      setProfile(next);
      toast.success(next.is_online ? (bn ? "হোম ভিজিট অন" : "Accepting visits") : bn ? "বন্ধ" : "Paused");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setBusy(true);
    try {
      await setHomeVisitStatus(id, status);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-teal-100 text-teal-800 grid place-items-center">
              <Home className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold">{bn ? "হোম ডাক্তারে জয়েন" : "Join Home Doctor"}</p>
              <p className="text-[11px] text-muted-foreground">
                {bn
                  ? "সার্ভিস এলাকা (জেলা/উপজেলা), ফি ও সময় নির্ধারণ করুন।"
                  : "Set service areas, fee and visit duration."}
              </p>
            </div>
          </div>

          <label className="block text-[11px] text-muted-foreground">
            {bn ? "ফি (টাকা)" : "Fee (BDT)"}
            <input
              className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-sm"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className="block text-[11px] text-muted-foreground">
            {bn ? "ভিজিট সময় (মিনিট)" : "Visit minutes"}
            <input
              className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-sm"
              value={visitMinutes}
              onChange={(e) => setVisitMinutes(e.target.value)}
              inputMode="numeric"
            />
          </label>
          <label className="block text-[11px] text-muted-foreground">
            {bn ? "সম্পর্কে (বাংলা)" : "About (BN)"}
            <textarea
              className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-sm min-h-[60px]"
              value={aboutBn}
              onChange={(e) => setAboutBn(e.target.value)}
            />
          </label>
          <label className="block text-[11px] text-muted-foreground">
            {bn ? "About (EN)" : "About (EN)"}
            <textarea
              className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-sm min-h-[60px]"
              value={aboutEn}
              onChange={(e) => setAboutEn(e.target.value)}
            />
          </label>

          <p className="text-xs font-semibold pt-1">{bn ? "সার্ভিস এলাকা" : "Service areas"}</p>
          {draftAreas.map((a, i) => (
            <div key={i} className="rounded-xl border p-2 space-y-2 relative">
              {draftAreas.length > 1 && (
                <button
                  type="button"
                  className="absolute top-2 right-2 text-muted-foreground"
                  onClick={() => setDraftAreas((prev) => prev.filter((_, j) => j !== i))}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <DistrictTypeahead
                value={a.district}
                onChange={(d) =>
                  setDraftAreas((prev) =>
                    prev.map((x, j) => (j === i ? { district: d, upazila: "" } : x)),
                  )
                }
              />
              <UpazilaSelect
                district={a.district}
                value={a.upazila}
                onChange={(u) =>
                  setDraftAreas((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, upazila: u } : x)),
                  )
                }
              />
            </div>
          ))}
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800"
            onClick={() => setDraftAreas((prev) => [...prev, { district: null, upazila: "" }])}
          >
            <Plus className="h-3.5 w-3.5" />
            {bn ? "এলাকা যোগ" : "Add area"}
          </button>

          <button
            type="button"
            disabled={joining}
            onClick={() => void handleJoin()}
            className="w-full rounded-xl bg-teal-700 text-white py-2.5 text-sm font-bold disabled:opacity-60"
          >
            {joining ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : bn ? "জয়েন করুন" : "Join"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold">{bn ? "হোম ডাক্তার প্রোফাইল" : "Home Doctor profile"}</p>
            <p className="text-[11px] text-muted-foreground">
              {formatCareMoney(profile.fee_amount, lang)} · {profile.visit_minutes}{" "}
              {bn ? "মিনিট" : "min"}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggleOnline()}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-semibold",
              profile.is_online ? "bg-emerald-600 text-white" : "border bg-background",
            )}
          >
            {profile.is_online
              ? bn
                ? "ভিজিট গ্রহণ চালু"
                : "Accepting visits"
              : bn
                ? "বন্ধ — চালু করুন"
                : "Paused — go live"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] text-muted-foreground">
            {bn ? "ফি" : "Fee"}
            <input
              className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
            />
          </label>
          <label className="text-[11px] text-muted-foreground">
            {bn ? "মিনিট" : "Minutes"}
            <input
              className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"
              value={visitMinutes}
              onChange={(e) => setVisitMinutes(e.target.value)}
            />
          </label>
        </div>
        <textarea
          className="w-full rounded-lg border px-2 py-1.5 text-sm min-h-[52px]"
          placeholder={bn ? "সম্পর্কে (বাংলা)" : "About (BN)"}
          value={aboutBn}
          onChange={(e) => setAboutBn(e.target.value)}
        />
        <textarea
          className="w-full rounded-lg border px-2 py-1.5 text-sm min-h-[52px]"
          placeholder="About (EN)"
          value={aboutEn}
          onChange={(e) => setAboutEn(e.target.value)}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveProfile()}
          className="rounded-lg bg-teal-700 text-white px-3 py-1.5 text-xs font-semibold"
        >
          {bn ? "প্রোফাইল সেভ" : "Save profile"}
        </button>
      </div>

      <div className="rounded-2xl border bg-card p-4 space-y-2">
        <p className="text-xs font-bold">{bn ? "সার্ভিস এলাকা" : "Service areas"}</p>
        <ul className="text-xs space-y-1">
          {areas.map((a) => (
            <li key={a.id} className="rounded-lg bg-muted/50 px-2 py-1">
              {bn ? a.district?.name_bn || a.district?.name : a.district?.name}
              {a.upazila ? ` · ${a.upazila}` : bn ? " · পুরো জেলা" : " · whole district"}
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-muted-foreground pt-1">
          {bn ? "এলাকা এডিট করতে নিচে নতুন তালিকা সেট করুন" : "Replace areas below"}
        </p>
        {draftAreas.map((a, i) => (
          <div key={i} className="space-y-1 rounded-lg border p-2">
            <DistrictTypeahead
              value={a.district}
              onChange={(d) =>
                setDraftAreas((prev) =>
                  prev.map((x, j) => (j === i ? { district: d, upazila: "" } : x)),
                )
              }
            />
            <UpazilaSelect
              district={a.district}
              value={a.upazila}
              onChange={(u) =>
                setDraftAreas((prev) => prev.map((x, j) => (j === i ? { ...x, upazila: u } : x)))
              }
            />
          </div>
        ))}
        <div className="flex gap-2">
          <button
            type="button"
            className="text-xs font-semibold text-teal-800"
            onClick={() => setDraftAreas((prev) => [...prev, { district: null, upazila: "" }])}
          >
            + {bn ? "এলাকা" : "Area"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveAreas()}
            className="rounded-lg bg-teal-700 text-white px-2.5 py-1 text-[10px] font-semibold"
          >
            {bn ? "এলাকা সেভ" : "Save areas"}
          </button>
        </div>
      </div>

      <HomeVisitScheduleEditor doctorId={doctorId} bn={bn} canEdit />

      <div className="rounded-2xl border bg-card p-4 space-y-2">
        <p className="text-xs font-bold">{bn ? "আসন্ন হোম ভিজিট" : "Upcoming home visits"}</p>
        {!queue.length ? (
          <p className="text-xs text-muted-foreground">{bn ? "কোনো বুকিং নেই" : "No bookings"}</p>
        ) : (
          <ul className="space-y-2">
            {queue.map((b) => (
              <li key={b.id} className="rounded-xl border p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {new Date(b.slot_start).toLocaleString(bn ? "bn-BD" : "en-US", {
                      timeZone: "Asia/Dhaka",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  <span
                    className={cn(
                      "text-[10px] font-semibold border rounded-full px-2 py-0.5",
                      homeVisitStatusTone(b.status),
                    )}
                  >
                    {homeVisitStatusLabel(b.status, lang)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">{b.visit_address}</p>
                <p className="text-[11px]">
                  {b.patient_name || "—"} · {b.patient_phone || "—"}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {b.status === "requested" && (
                    <button
                      type="button"
                      className="rounded-lg bg-sky-600 text-white px-2 py-1 text-[10px] font-semibold"
                      onClick={() => void setStatus(b.id, "confirmed")}
                    >
                      {bn ? "কনফার্ম" : "Confirm"}
                    </button>
                  )}
                  {(b.status === "confirmed" || b.status === "requested") && (
                    <button
                      type="button"
                      className="rounded-lg border px-2 py-1 text-[10px] font-semibold"
                      onClick={() => void setStatus(b.id, "en_route")}
                    >
                      {bn ? "পথে" : "En route"}
                    </button>
                  )}
                  {b.status !== "completed" && b.status !== "cancelled" && (
                    <button
                      type="button"
                      className="rounded-lg bg-emerald-600 text-white px-2 py-1 text-[10px] font-semibold"
                      onClick={() => void setStatus(b.id, "completed")}
                    >
                      {bn ? "সম্পন্ন" : "Complete"}
                    </button>
                  )}
                  {b.status !== "cancelled" && b.status !== "completed" && (
                    <button
                      type="button"
                      className="rounded-lg text-rose-600 px-2 py-1 text-[10px] font-semibold"
                      onClick={() => void setStatus(b.id, "cancelled")}
                    >
                      {bn ? "বাতিল" : "Cancel"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
