import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Video, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import {
  ensureTeleZoomMeeting,
  fetchConsultantTeleQueue,
  fetchMyLinkedTeleDoctorId,
  fetchUnlinkedVideoDoctors,
  claimTeleDoctor,
  setDoctorOnline,
  setTeleStatus,
  type TeleBooking,
  type TeleVideoDoctor,
} from "@/lib/tele-api";
import { TeleRxEditor } from "@/components/care/tele/TeleRxEditor";
import { fetchTeleAiSummary } from "@/lib/tele-api";

export function ConsultantTeleDesk() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const { user } = useAuth();
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [queue, setQueue] = useState<TeleBooking[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [claimable, setClaimable] = useState<TeleVideoDoctor[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [resolving, setResolving] = useState(true);

  async function loadDoctor(uid: string) {
    setResolving(true);
    try {
      const id = await fetchMyLinkedTeleDoctorId(uid);
      setDoctorId(id);
      if (id) {
        const { data: prof } = await supabase
          .from("tele_doctor_profiles")
          .select("is_online")
          .eq("doctor_id", id)
          .maybeSingle();
        setOnline(!!(prof as { is_online?: boolean } | null)?.is_online);
        setClaimable([]);
      } else {
        setClaimable(await fetchUnlinkedVideoDoctors());
      }
    } finally {
      setResolving(false);
    }
  }

  useEffect(() => {
    if (!user?.id) {
      setResolving(false);
      return;
    }
    void loadDoctor(user.id).catch(() => setResolving(false));
  }, [user?.id]);

  async function reloadQueue(did: string) {
    setQueue(await fetchConsultantTeleQueue(did));
  }

  useEffect(() => {
    if (!doctorId) return;
    void reloadQueue(doctorId).catch(() => undefined);
    const t = window.setInterval(() => void reloadQueue(doctorId), 15000);
    return () => window.clearInterval(t);
  }, [doctorId]);

  useEffect(() => {
    if (!active) {
      setSummary(null);
      return;
    }
    void fetchTeleAiSummary(active).then((s) =>
      setSummary(bn ? s?.summary_bn ?? null : s?.summary_en ?? null),
    );
  }, [active, bn]);

  async function toggleOnline() {
    if (!doctorId) return;
    const next = !online;
    await setDoctorOnline(doctorId, next);
    setOnline(next);
    toast.success(next ? (bn ? "অনলাইন" : "Online") : bn ? "অফলাইন" : "Offline");
  }

  async function claim(id: string) {
    setClaiming(true);
    try {
      await claimTeleDoctor(id);
      toast.success(bn ? "ডাক্তার প্রোফাইল লিংক হয়েছে" : "Doctor profile linked");
      if (user?.id) await loadDoctor(user.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setClaiming(false);
    }
  }

  async function startCall(bookingId: string) {
    setBusy(true);
    try {
      await setTeleStatus(bookingId, "ready");
      const zoom = await ensureTeleZoomMeeting(bookingId, "host");
      if (zoom.start_url) {
        await setTeleStatus(bookingId, "in_call");
        window.open(zoom.start_url, "_blank", "noopener,noreferrer");
      } else if (zoom.join_url) {
        window.open(zoom.join_url, "_blank", "noopener,noreferrer");
      } else {
        toast.error(bn ? "Zoom তৈরি হয়নি — সিক্রেট চেক করুন" : "Zoom not created — check secrets");
      }
      if (doctorId) await reloadQueue(doctorId);
      setActive(bookingId);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-[40dvh] grid place-items-center text-sm text-muted-foreground">
        {bn ? "লগইন করুন" : "Please sign in"}
      </div>
    );
  }

  if (resolving) {
    return (
      <div className="min-h-[40dvh] grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
      </div>
    );
  }

  if (!doctorId) {
    return (
      <div className="w-full">
        <AutoHideHeader className="z-30 border-b bg-background/90 backdrop-blur safe-top">
          <div className="flex items-center gap-2 px-3 py-2 max-w-3xl mx-auto w-full">
            <PageBackButton fallbackTo="/care/portal" />
            <h1 className="text-sm font-bold">{bn ? "ভিডিও ডেস্ক" : "Video desk"}</h1>
          </div>
        </AutoHideHeader>
        <div className="px-3 py-6 max-w-lg mx-auto space-y-4">
          <p className="text-sm text-muted-foreground">
            {bn
              ? "আপনার অ্যাকাউন্টে এখনও কোনো ভিডিও ডাক্তার লিংক নেই। নিচ থেকে একটি প্রোফাইল বেছে নিন (ডেমো/আনলিংকড)।"
              : "No video doctor is linked to your account yet. Pick an unlinked profile below."}
          </p>
          {claimable.length === 0 ? (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
              {bn
                ? "কোনো আনলিংকড ভিডিও ডাক্তার নেই — অ্যাডমিন থেকে লিংক করুন।"
                : "No unlinked video doctors — ask admin to link one."}
            </p>
          ) : (
            <ul className="space-y-2">
              {claimable.map((d) => (
                <li key={d.doctor_id} className="flex items-center justify-between gap-2 rounded-xl border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {bn ? d.full_name_bn || d.full_name : d.full_name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {bn ? d.specialty_name_bn : d.specialty_name_en} · ৳{d.fee_amount ?? 0}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={claiming}
                    onClick={() => void claim(d.doctor_id)}
                    className="shrink-0 rounded-lg bg-sky-600 text-white px-3 py-1.5 text-xs font-semibold"
                  >
                    {claiming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : bn ? "লিংক করুন" : "Link"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <AutoHideHeader className="z-30 border-b bg-background/90 backdrop-blur safe-top">
        <div className="flex items-center justify-between gap-2 px-3 py-2 max-w-3xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <PageBackButton fallbackTo="/care/portal" />
            <h1 className="text-sm font-bold">{bn ? "ভিডিও ডেস্ক" : "Video desk"}</h1>
          </div>
          <button
            type="button"
            onClick={() => void toggleOnline()}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold ${
              online ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"
            }`}
          >
            {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {online ? (bn ? "অনলাইন" : "Online") : bn ? "অফলাইন" : "Offline"}
          </button>
        </div>
      </AutoHideHeader>

      <div className="px-3 py-4 max-w-3xl mx-auto grid gap-4 md:grid-cols-2 pb-10">
        <div className="space-y-2">
          <h2 className="text-sm font-bold">{bn ? "আজকের কিউ" : "Today queue"}</h2>
          {queue.length === 0 && (
            <p className="text-xs text-muted-foreground">{bn ? "কোনো বুকিং নেই" : "No bookings"}</p>
          )}
          {queue.map((b) => (
            <div
              key={b.id}
              className={`rounded-xl border p-3 space-y-2 ${active === b.id ? "border-sky-500 bg-sky-50/50" : ""}`}
            >
              <button type="button" className="w-full text-left" onClick={() => setActive(b.id)}>
                <p className="text-xs font-semibold capitalize">{b.status.replace(/_/g, " ")}</p>
                <p className="text-[10px] text-muted-foreground">
                  {b.patient_name || b.patient_phone || b.id.slice(0, 8)} · ৳{b.net_amount}
                </p>
              </button>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void startCall(b.id)}
                  className="inline-flex items-center gap-1 rounded-lg bg-sky-600 text-white px-2 py-1 text-[10px] font-semibold"
                >
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Video className="h-3 w-3" />}
                  {bn ? "Zoom শুরু" : "Start Zoom"}
                </button>
                <button
                  type="button"
                  className="rounded-lg border px-2 py-1 text-[10px]"
                  onClick={() =>
                    void setTeleStatus(b.id, "completed")
                      .then(() => reloadQueue(doctorId))
                      .catch((e) => toast.error((e as Error).message))
                  }
                >
                  {bn ? "সম্পন্ন" : "Complete"}
                </button>
                <button
                  type="button"
                  className="rounded-lg border px-2 py-1 text-[10px]"
                  onClick={() =>
                    void setTeleStatus(b.id, "no_show")
                      .then(() => reloadQueue(doctorId))
                      .catch((e) => toast.error((e as Error).message))
                  }
                >
                  No-show
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {active && doctorId ? (
            <>
              {summary && (
                <div className="rounded-xl border p-3 text-xs space-y-1">
                  <p className="font-bold">{bn ? "AI সারাংশ (খসড়া)" : "AI summary (draft)"}</p>
                  <p className="text-muted-foreground whitespace-pre-wrap">{summary}</p>
                </div>
              )}
              <TeleRxEditor bookingId={active} doctorId={doctorId} />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              {bn ? "প্রেসক্রিপশনের জন্য একটি বুকিং বেছে নিন।" : "Select a booking to write a prescription."}
            </p>
          )}
          <Link to="/care/video" className="text-xs font-semibold text-sky-600">
            {bn ? "রোগী ভিউ ›" : "Patient view ›"}
          </Link>
        </div>
      </div>
    </div>
  );
}
