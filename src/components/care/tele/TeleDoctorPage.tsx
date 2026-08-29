import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Calendar, Share2, Star, Video } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useI18n } from "@/lib/i18n";
import { formatCareMoney } from "@/lib/care-invoice";
import {
  fetchTeleDoctor,
  fetchTeleDoctorSlots,
  WEEKDAY_LABELS,
  type TeleVideoDoctor,
} from "@/lib/tele-api";
import type { TeleDoctorSlot } from "@/lib/tele-cms";
import { supabase } from "@/integrations/supabase/client";

export function TeleDoctorPage({ doctorId }: { doctorId: string }) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const navigate = useNavigate();
  const [d, setD] = useState<TeleVideoDoctor | null>(null);
  const [slots, setSlots] = useState<TeleDoctorSlot[]>([]);
  const [tab, setTab] = useState<"info" | "experience" | "reviews">("info");
  const [reviews, setReviews] = useState<{ rating: number; comment: string | null }[]>([]);

  useEffect(() => {
    void fetchTeleDoctor(doctorId).then(setD).catch((e) => toast.error((e as Error).message));
    void fetchTeleDoctorSlots(doctorId).then(setSlots).catch(() => undefined);
    void supabase
      .from("tele_reviews")
      .select("rating, comment")
      .eq("doctor_id", doctorId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setReviews((data ?? []) as { rating: number; comment: string | null }[]));
  }, [doctorId]);

  if (!d) {
    return (
      <div className="min-h-[40dvh] grid place-items-center text-sm text-muted-foreground">
        {bn ? "লোড হচ্ছে…" : "Loading…"}
      </div>
    );
  }

  const name = bn ? d.full_name_bn || d.full_name : d.full_name;
  const about = bn ? d.about_bn : d.about_en;
  const workplace = bn ? d.workplace_bn : d.workplace_en;

  return (
    <div className="w-full">
      <AutoHideHeader className="z-30 border-b bg-background/90 backdrop-blur safe-top">
        <div className="flex items-center justify-between gap-2 px-3 py-2 max-w-3xl mx-auto w-full">
          <div className="flex items-center gap-2 min-w-0">
            <PageBackButton fallbackTo="/care/video" />
            <p className="text-[10px] text-muted-foreground truncate">Home / Doctors / {name}</p>
          </div>
          <button
            type="button"
            className="h-8 w-8 grid place-items-center rounded-lg hover:bg-muted"
            onClick={() => {
              void navigator.clipboard?.writeText(window.location.href);
              toast.success(bn ? "লিংক কপি" : "Link copied");
            }}
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </AutoHideHeader>

      <div className="px-3 py-4 max-w-3xl mx-auto space-y-4 pb-24">
        <div className="flex gap-3">
          <div className="relative h-24 w-24 shrink-0 rounded-2xl overflow-hidden bg-muted">
            {(d.hero_image_url || d.photo_url) && (
              <img src={d.hero_image_url || d.photo_url || ""} alt="" className="h-full w-full object-cover" />
            )}
            <span className="absolute bottom-1 left-1 rounded bg-sky-600 text-white text-[9px] px-1.5 py-0.5">
              {bn ? "অ্যাপয়েন্টমেন্ট" : "Appointment"}
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="text-lg font-bold leading-tight">{name}</h1>
            {d.qualifications && <p className="text-[11px] text-muted-foreground">{d.qualifications}</p>}
            {(d.specialty_name_bn || d.specialty_name_en) && (
              <span className="inline-block rounded-full bg-sky-100 text-sky-800 text-[10px] font-semibold px-2 py-0.5">
                {bn ? d.specialty_name_bn : d.specialty_name_en}
              </span>
            )}
            <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground pt-1">
              {d.experience_years != null && (
                <span>
                  <strong className="text-foreground">{d.experience_years}+</strong> {bn ? "বছর" : "Years"}
                </span>
              )}
              {d.bmdc_no && (
                <span>
                  BMDC <strong className="text-foreground">{d.bmdc_no}</strong>
                </span>
              )}
              <span className="inline-flex items-center gap-0.5 text-amber-600">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {d.rating_avg} ({d.rating_count})
              </span>
            </div>
            {workplace && <p className="text-[11px] text-muted-foreground">{workplace}</p>}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl border bg-sky-50/50 px-3 py-3">
          <div>
            <p className="text-[10px] text-muted-foreground">{bn ? "কনসালটেশন ফি" : "Consultation fee"}</p>
            <p className="text-xl font-bold text-sky-800">{formatCareMoney(d.fee_amount ?? 0)}</p>
          </div>
          <button
            type="button"
            onClick={() =>
              void navigate({
                to: "/care/video/checkout",
                search: { mode: "named", doctorId: d.doctor_id },
              })
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 text-white px-4 py-2.5 text-sm font-semibold"
          >
            <Calendar className="h-4 w-4" />
            {bn ? "বুক অ্যাপয়েন্টমেন্ট" : "Book Appointment"}
          </button>
        </div>

        <div className="flex gap-4 border-b text-xs font-semibold">
          {(
            [
              ["info", bn ? "তথ্য" : "Info"],
              ["experience", bn ? "অভিজ্ঞতা" : "Experience"],
              ["reviews", bn ? "রিভিউ" : "Reviews"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`pb-2 ${tab === id ? "border-b-2 border-sky-600 text-sky-700" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <h2 className="text-sm font-bold">{bn ? "ডাক্তার সম্পর্কে" : "About Doctor"}</h2>
            {tab === "info" && (
              <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {about || (bn ? "বিবরণ যোগ করা হয়নি।" : "No bio yet.")}
              </p>
            )}
            {tab === "experience" && (
              <p className="text-xs text-muted-foreground">
                {d.experience_years != null
                  ? bn
                    ? `${d.experience_years}+ বছরের অভিজ্ঞতা`
                    : `${d.experience_years}+ years experience`
                  : "—"}
              </p>
            )}
            {tab === "reviews" && (
              <div className="space-y-2">
                {reviews.length === 0 && (
                  <p className="text-xs text-muted-foreground">{bn ? "কোনো রিভিউ নেই" : "No reviews"}</p>
                )}
                {reviews.map((r, i) => (
                  <div key={i} className="rounded-xl border p-2 text-xs">
                    <p className="font-semibold text-amber-600">★ {r.rating}</p>
                    {r.comment && <p className="text-muted-foreground mt-0.5">{r.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border p-3 space-y-2">
            <h2 className="text-sm font-bold inline-flex items-center gap-1.5">
              <Video className="h-4 w-4 text-sky-600" />
              {bn ? "তাৎক্ষণিক কনসালটেশন সময়" : "Instant Consultation Time"}
            </h2>
            <ul className="space-y-1.5 text-xs">
              {slots.length === 0 && (
                <li className="text-muted-foreground">{bn ? "সময়সূচি নেই" : "No schedule listed"}</li>
              )}
              {slots.map((s) => (
                <li key={s.id} className="flex justify-between gap-2 border-b border-dashed py-1">
                  <span className="font-medium">{(bn ? WEEKDAY_LABELS.bn : WEEKDAY_LABELS.en)[s.weekday]}</span>
                  <span className="text-muted-foreground">
                    {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                  </span>
                </li>
              ))}
            </ul>
            <Link to="/care/video" className="text-[11px] font-semibold text-sky-600">
              {bn ? "সব ডাক্তার ›" : "All doctors ›"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
