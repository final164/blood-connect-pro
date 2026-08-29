import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Calendar, Share2, Star, Video } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useI18n } from "@/lib/i18n";
import { formatCareMoney } from "@/lib/care-invoice";
import { fetchTeleSettings } from "@/lib/tele-cms";
import {
  fetchTeleDoctor,
  fetchTeleDoctorSlots,
  type TeleVideoDoctor,
} from "@/lib/tele-api";
import type { TeleDoctorSlot } from "@/lib/tele-cms";
import { supabase } from "@/integrations/supabase/client";
import { summarizeWindows } from "@/lib/tele-slots";
import { TeleSlotPickerModal } from "@/components/care/tele/TeleSlotPickerModal";

export function TeleDoctorPage({ doctorId }: { doctorId: string }) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const navigate = useNavigate();
  const [d, setD] = useState<TeleVideoDoctor | null>(null);
  const [slots, setSlots] = useState<TeleDoctorSlot[]>([]);
  const [tab, setTab] = useState<"info" | "experience" | "reviews">("info");
  const [reviews, setReviews] = useState<{ rating: number; comment: string | null }[]>([]);
  const [vatPct, setVatPct] = useState(5);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    void fetchTeleDoctor(doctorId).then(setD).catch((e) => toast.error((e as Error).message));
    void fetchTeleDoctorSlots(doctorId).then(setSlots).catch(() => undefined);
    void fetchTeleSettings().then((s) => {
      if (s.vat_percent != null) setVatPct(s.vat_percent);
    });
    void supabase
      .from("tele_reviews")
      .select("rating, comment")
      .eq("doctor_id", doctorId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setReviews((data ?? []) as { rating: number; comment: string | null }[]));
  }, [doctorId]);

  const fee = Number(d?.fee_amount ?? 0);
  const vat = Math.round(fee * (vatPct / 100) * 100) / 100;
  const net = Math.round((fee + vat) * 100) / 100;

  const scheduleSummary = useMemo(
    () => summarizeWindows(slots, bn ? "bn" : "en"),
    [slots, bn],
  );

  const canBook = !!d?.schedule_public && slots.length > 0 && d.video_enabled !== false;

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
  const tags = bn ? d.specialty_tags_bn ?? [] : d.specialty_tags_en ?? [];
  const notice = bn ? d.notice_bn : d.notice_en;
  const instructions = bn ? d.instructions_bn : d.instructions_en;
  const chamber = bn ? d.chamber_address_bn : d.chamber_address_en;

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
          <div className="relative h-28 w-28 shrink-0 rounded-2xl overflow-hidden bg-muted shadow-sm">
            {(d.hero_image_url || d.photo_url) && (
              <img src={d.hero_image_url || d.photo_url || ""} alt="" className="h-full w-full object-cover" />
            )}
            <span className="absolute bottom-1 left-1 rounded bg-sky-600 text-white text-[9px] px-1.5 py-0.5 font-semibold">
              {bn ? "অ্যাপয়েন্টমেন্ট" : "Appointment"}
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <h1 className="text-lg font-bold leading-tight">{name}</h1>
            {d.qualifications && (
              <p className="text-[11px] text-muted-foreground leading-snug">{d.qualifications}</p>
            )}
            <div className="flex flex-wrap gap-1">
              {(tags.length
                ? tags
                : [bn ? d.specialty_name_bn : d.specialty_name_en].filter(Boolean)
              ).map((t) => (
                <span
                  key={String(t)}
                  className="rounded-full bg-sky-100 text-sky-800 text-[10px] font-semibold px-2 py-0.5"
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground pt-0.5">
              {d.experience_years != null && (
                <span>
                  <span className="text-muted-foreground/80">{bn ? "অভিজ্ঞতা" : "Experience"} </span>
                  <strong className="text-foreground">{d.experience_years}+</strong>{" "}
                  {bn ? "বছর" : "Years"}
                </span>
              )}
              {d.bmdc_no && (
                <span>
                  BMDC <strong className="text-foreground">{d.bmdc_no}</strong>
                </span>
              )}
              <span className="inline-flex items-center gap-0.5 text-amber-600">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <strong>{Number(d.rating_avg || 0).toFixed(1)}</strong>
                <span className="text-muted-foreground">({d.rating_count})</span>
              </span>
            </div>
            {workplace && (
              <p className="text-[11px] text-muted-foreground">
                {bn ? "কর্মরত" : "Working in"} {workplace}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl border bg-sky-50/60 px-3 py-3">
          <div>
            <p className="text-[10px] text-muted-foreground">{bn ? "কনসালটেশন ফি" : "Consultation fee"}</p>
            <p className="text-xl font-bold text-sky-800">
              {formatCareMoney(net)}
              <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                ({bn ? "VAT সহ" : "Inc. VAT"})
              </span>
            </p>
          </div>
          <button
            type="button"
            disabled={!canBook}
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            <Calendar className="h-4 w-4" />
            {bn ? "বুক অ্যাপয়েন্টমেন্ট" : "Book Appointment"}
          </button>
        </div>
        {!canBook && (
          <p className="text-[11px] text-amber-700 -mt-2">
            {bn ? "এই ডাক্তার এখন অ্যাপয়েন্টমেন্ট নিচ্ছেন না।" : "This doctor is not accepting appointments."}
          </p>
        )}

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
          <div className="space-y-3">
            <h2 className="text-sm font-bold">{bn ? "ডাক্তার সম্পর্কে" : "About Doctor"}</h2>
            {tab === "info" && (
              <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
                {about && <p className="whitespace-pre-wrap text-foreground/90">{about}</p>}
                {notice && (
                  <p className="rounded-xl bg-amber-50 text-amber-900 px-3 py-2 whitespace-pre-wrap">{notice}</p>
                )}
                {instructions && (
                  <div>
                    <p className="font-semibold text-foreground mb-1">
                      {bn ? "ভিডিও কল নির্দেশনা" : "Video call instructions"}
                    </p>
                    <p className="whitespace-pre-wrap">{instructions}</p>
                  </div>
                )}
                {d.helpline && (
                  <p>
                    {bn ? "হেল্পলাইন" : "Helpline"}:{" "}
                    <strong className="text-foreground">{d.helpline}</strong>
                    {d.doctor_code ? (
                      <>
                        {" "}
                        · {bn ? "ডাক্তার কোড" : "Doctor code"}{" "}
                        <strong className="text-foreground">{d.doctor_code}</strong>
                      </>
                    ) : null}
                  </p>
                )}
                {chamber && (
                  <p>
                    {bn ? "চেম্বার" : "Chamber"}: {chamber}
                  </p>
                )}
              </div>
            )}
            {tab === "experience" && (
              <p className="text-xs text-muted-foreground">
                {d.experience_years != null
                  ? bn
                    ? `${d.experience_years}+ বছরের অভিজ্ঞতা`
                    : `${d.experience_years}+ years experience`
                  : "—"}
                {workplace ? ` · ${workplace}` : ""}
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

          <div className="rounded-2xl border bg-muted/20 p-3 space-y-3">
            <h2 className="text-sm font-bold inline-flex items-center gap-1.5">
              <Video className="h-4 w-4 text-sky-600" />
              {bn ? "এক নজরে" : "At a Glance"}
            </h2>
            <div className="space-y-2 text-xs">
              <div>
                <p className="text-[10px] text-muted-foreground font-medium">
                  {bn ? "তাৎক্ষণিক / অ্যাপয়েন্টমেন্ট সময়" : "Consultation time"}
                </p>
                <p className="font-medium leading-snug">{scheduleSummary}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <GlanceCell
                  label={bn ? "কনসালটেশন ফি" : "Consultation Fee"}
                  value={`${formatCareMoney(net)}`}
                  hint={bn ? "VAT সহ" : "inc. VAT"}
                />
                <GlanceCell
                  label={bn ? "ফলো-আপ ফি" : "Follow-Up Fee"}
                  value={
                    d.follow_up_fee != null
                      ? formatCareMoney(d.follow_up_fee)
                      : "—"
                  }
                  hint={
                    d.follow_up_days
                      ? bn
                        ? `${d.follow_up_days} দিনের মধ্যে`
                        : `within ${d.follow_up_days} days`
                      : undefined
                  }
                />
                <GlanceCell
                  label={bn ? "রোগী দেখেছেন" : "Patient Attended"}
                  value={String(d.patients_attended ?? 0)}
                />
                <GlanceCell
                  label={bn ? "যোগদান" : "Joined"}
                  value={
                    d.joined_at
                      ? new Date(d.joined_at).toLocaleDateString(bn ? "bn-BD" : "en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "—"
                  }
                />
                <GlanceCell label={bn ? "ডাক্তার কোড" : "Doctor Code"} value={d.doctor_code || "—"} />
                <GlanceCell
                  label={bn ? "গড় সময়" : "Avg. Consultation"}
                  value={`${d.avg_consult_minutes ?? d.slot_minutes ?? 15} ${bn ? "মিনিট" : "min"}`}
                />
              </div>
            </div>
            <Link to="/care/video" className="text-[11px] font-semibold text-sky-600">
              {bn ? "সব ডাক্তার ›" : "All doctors ›"}
            </Link>
          </div>
        </div>
      </div>

      <TeleSlotPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        doctorId={d.doctor_id}
        windows={slots}
        slotMinutes={d.slot_minutes || 15}
        onConfirm={({ start, end }) => {
          void navigate({
            to: "/care/video/checkout",
            search: {
              mode: "named",
              doctorId: d.doctor_id,
              slotStart: start.toISOString(),
              slotEnd: end.toISOString(),
            },
          });
        }}
      />
    </div>
  );
}

function GlanceCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl bg-background border px-2.5 py-2">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-xs font-bold text-sky-800 mt-0.5">{value}</p>
      {hint && <p className="text-[9px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
