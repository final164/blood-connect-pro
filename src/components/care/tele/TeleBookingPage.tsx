import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Star, Video } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useI18n } from "@/lib/i18n";
import { formatCareMoney } from "@/lib/care-invoice";
import { fetchTeleSettings } from "@/lib/tele-cms";
import {
  ensureTeleZoomMeeting,
  fetchTeleAiSummary,
  fetchTeleBooking,
  fetchTeleDoctor,
  setTeleStatus,
  submitTeleReview,
  type TeleAiSummary,
  type TeleBooking,
  type TeleVideoDoctor,
} from "@/lib/tele-api";
import { TeleRxView } from "@/components/care/tele/TeleRxView";
import { telePaymentLabel, teleStatusLabel, teleStatusTone } from "@/lib/tele-status";

export function TeleBookingPage({ bookingId }: { bookingId: string }) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const [booking, setBooking] = useState<TeleBooking | null>(null);
  const [doctor, setDoctor] = useState<TeleVideoDoctor | null>(null);
  const [summary, setSummary] = useState<TeleAiSummary | null>(null);
  const [disclaimer, setDisclaimer] = useState("");
  const [joinCta, setJoinCta] = useState("");
  const [joining, setJoining] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  async function reload() {
    const b = await fetchTeleBooking(bookingId);
    setBooking(b);
    if (b?.doctor_id) setDoctor(await fetchTeleDoctor(b.doctor_id));
    setSummary(await fetchTeleAiSummary(bookingId));
  }

  useEffect(() => {
    void reload().catch((e) => toast.error((e as Error).message));
    void fetchTeleSettings().then((s) => {
      setDisclaimer(bn ? s.ui.summary_disclaimer_bn : s.ui.summary_disclaimer_en);
      setJoinCta(bn ? s.ui.join_cta_bn : s.ui.join_cta_en);
    });
  }, [bookingId, bn]);

  async function join() {
    if (!booking) return;
    setJoining(true);
    try {
      if (booking.status === "confirmed") await setTeleStatus(booking.id, "ready");
      const zoom = await ensureTeleZoomMeeting(booking.id, "patient");
      if (zoom.join_url) {
        await setTeleStatus(booking.id, "in_call");
        window.open(zoom.join_url, "_blank", "noopener,noreferrer");
      } else {
        toast.error(bn ? "Zoom লিংক পাওয়া যায়নি — পরে চেষ্টা করুন" : "Zoom link unavailable — try later");
      }
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setJoining(false);
    }
  }

  if (!booking) {
    return (
      <div className="min-h-[40dvh] grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
      </div>
    );
  }

  const canJoin =
    ["confirmed", "ready", "in_call"].includes(booking.status) &&
    (booking.payment_status === "paid" || booking.payment_status === "waived");

  return (
    <div className="w-full">
      <AutoHideHeader className="z-30 border-b bg-background/90 backdrop-blur safe-top">
        <div className="flex items-center gap-2 px-3 py-2 max-w-2xl mx-auto w-full">
          <PageBackButton fallbackTo="/care/video" />
          <h1 className="text-sm font-bold">{bn ? "বুকিং বিবরণ" : "Booking details"}</h1>
        </div>
      </AutoHideHeader>

      <div className="px-3 py-4 max-w-2xl mx-auto space-y-4 pb-10">
        <div className="rounded-2xl border bg-white shadow-sm p-4 space-y-3">
          <div className="flex justify-between items-start gap-2 text-xs">
            <span className={`rounded-full px-2.5 py-0.5 font-semibold ${teleStatusTone(booking.status)}`}>
              {teleStatusLabel(booking.status, bn)}
            </span>
            <span className="text-muted-foreground font-medium">{telePaymentLabel(booking.payment_status, bn)}</span>
          </div>
          {doctor && (
            <div className="flex gap-3 items-center">
              <div className="h-12 w-12 rounded-xl overflow-hidden bg-muted shrink-0">
                {(doctor.photo_url || doctor.hero_image_url) && (
                  <img
                    src={doctor.hero_image_url || doctor.photo_url || ""}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">
                  {bn ? doctor.full_name_bn || doctor.full_name : doctor.full_name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {bn ? doctor.specialty_name_bn : doctor.specialty_name_en}
                </p>
              </div>
            </div>
          )}
          {booking.slot_start && (
            <p className="text-xs text-muted-foreground rounded-xl bg-sky-50 px-3 py-2">
              {new Date(booking.slot_start).toLocaleString(bn ? "bn-BD" : "en-US", {
                timeZone: "Asia/Dhaka",
                dateStyle: "full",
                timeStyle: "short",
              })}
            </p>
          )}
          <p className="text-lg font-bold text-sky-800">{formatCareMoney(booking.net_amount)}</p>
          {canJoin && (
            <button
              type="button"
              disabled={joining}
              onClick={() => void join()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 text-white py-2.5 text-sm font-semibold shadow-sm"
            >
              {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
              {joinCta || (bn ? "Zoom-এ যোগ দিন" : "Join Zoom")}
            </button>
          )}
        </div>

        {(summary?.summary_bn || summary?.summary_en) && (
          <div className="rounded-2xl border p-4 space-y-2">
            <h2 className="text-sm font-bold">{bn ? "AI সারসংক্ষেপ" : "AI summary"}</h2>
            <p className="text-[10px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1">{disclaimer}</p>
            <p className="text-xs leading-relaxed whitespace-pre-wrap">
              {bn ? summary.summary_bn || summary.summary_en : summary.summary_en || summary.summary_bn}
            </p>
          </div>
        )}

        <TeleRxView bookingId={bookingId} />

        {booking.status === "completed" && booking.doctor_id && (
          <div className="rounded-2xl border p-4 space-y-2">
            <h2 className="text-sm font-bold">{bn ? "রেটিং দিন" : "Rate consultation"}</h2>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)}>
                  <Star
                    className={`h-5 w-5 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                  />
                </button>
              ))}
            </div>
            <textarea
              className="w-full rounded-xl border px-3 py-2 text-xs"
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={bn ? "মন্তব্য (ঐচ্ছিক)" : "Comment (optional)"}
            />
            <button
              type="button"
              className="rounded-xl bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold"
              onClick={() =>
                void submitTeleReview({
                  bookingId: booking.id,
                  doctorId: booking.doctor_id!,
                  rating,
                  comment,
                })
                  .then(() => toast.success(bn ? "ধন্যবাদ" : "Thanks"))
                  .catch((e) => toast.error((e as Error).message))
              }
            >
              {bn ? "জমা দিন" : "Submit"}
            </button>
          </div>
        )}

        <Link to="/care/video" className="text-xs font-semibold text-sky-600">
          {bn ? "← ভিডিও হাব" : "← Video hub"}
        </Link>
      </div>
    </div>
  );
}
