import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Calendar, Home, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { TeleSlotPickerModal } from "@/components/care/tele/TeleSlotPickerModal";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { formatCareMoney } from "@/lib/care-invoice";
import type { TeleDoctorSlot } from "@/lib/tele-cms";
import { summarizeWindows } from "@/lib/tele-slots";
import {
  bookHomeVisit,
  fetchHomeDoctorBookedStarts,
  fetchHomeDoctorCard,
  fetchHomeDoctorSlots,
  loadCachedHomeLocation,
  type CareHomeDoctorCard,
} from "@/lib/care-home-api";

export function CareHomeDoctorPage({ doctorId }: { doctorId: string }) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const { session, isAnonymous } = useAuth();
  const navigate = useNavigate();
  const [d, setD] = useState<CareHomeDoctorCard | null>(null);
  const [windows, setWindows] = useState<TeleDoctorSlot[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    void fetchHomeDoctorCard(doctorId)
      .then(setD)
      .catch((e) => toast.error((e as Error).message));
    void fetchHomeDoctorSlots(doctorId)
      .then((rows) =>
        setWindows(
          rows.map((r) => ({
            id: r.id,
            doctor_id: r.doctor_id,
            weekday: r.weekday,
            start_time: r.start_time,
            end_time: r.end_time,
            is_active: r.is_active,
          })),
        ),
      )
      .catch(() => setWindows([]));
  }, [doctorId]);

  const scheduleSummary = useMemo(
    () => summarizeWindows(windows, bn ? "bn" : "en"),
    [windows, bn],
  );

  async function onSlotConfirm(slot: { start: Date; end: Date }) {
    const loc = loadCachedHomeLocation();
    if (!loc) {
      toast.error(bn ? "আগে লোকেশন সেট করুন" : "Set location first");
      void navigate({ to: "/care/home-doctor" });
      return;
    }
    if (!session || isAnonymous) {
      toast.error(bn ? "বুকিংয়ের জন্য সাইন ইন করুন" : "Sign in to book");
      void navigate({ to: "/auth", search: { next: `/care/home-doctor/${doctorId}` } as never });
      return;
    }
    setBooking(true);
    try {
      const b = await bookHomeVisit({
        doctorId,
        slotStart: slot.start.toISOString(),
        slotEnd: slot.end.toISOString(),
        location: loc,
      });
      toast.success(bn ? "বুকিং হয়েছে" : "Visit booked");
      setPickerOpen(false);
      void navigate({ to: "/care/home-visit/$id", params: { id: b.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBooking(false);
    }
  }

  if (!d) {
    return (
      <div className="min-h-[40dvh] grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
      </div>
    );
  }

  const name = bn ? d.full_name_bn || d.full_name : d.full_name;
  const about = bn ? d.about_bn : d.about_en;

  return (
    <div className="w-full min-h-dvh bg-gradient-to-b from-teal-50/60 to-background">
      <AutoHideHeader className="z-30 border-b bg-background/90 backdrop-blur safe-top">
        <div className="flex items-center gap-2 px-3 py-2 max-w-2xl mx-auto w-full">
          <PageBackButton fallbackTo="/care/home-doctor" />
          <p className="text-sm font-bold truncate">{name}</p>
        </div>
      </AutoHideHeader>

      <div className="px-3 py-4 max-w-2xl mx-auto space-y-4 pb-28">
        <div className="flex gap-3">
          <div className="h-24 w-24 rounded-2xl overflow-hidden bg-muted shrink-0">
            {d.photo_url ? (
              <img src={d.photo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full grid place-items-center text-teal-700">
                <Home className="h-8 w-8" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black">{name}</h1>
            <p className="text-xs text-muted-foreground">
              {bn ? d.specialty_name_bn : d.specialty_name_en}
              {d.public_bmdc ? ` · BMDC ${d.public_bmdc}` : ""}
            </p>
            <p className="text-sm font-bold text-teal-800 mt-1">
              {formatCareMoney(d.fee_amount, lang)}
              <span className="font-normal text-muted-foreground text-xs">
                {" "}
                · {d.visit_minutes} {bn ? "মিনিট" : "min"}
              </span>
            </p>
            {d.is_online && (
              <span className="inline-block mt-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                {bn ? "আজ ভিজিট গ্রহণ করছেন" : "Accepting visits today"}
              </span>
            )}
          </div>
        </div>

        {about && (
          <div className="rounded-2xl border bg-card p-3">
            <p className="text-xs font-bold mb-1">{bn ? "সম্পর্কে" : "About"}</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{about}</p>
          </div>
        )}

        {d.areas.length > 0 && (
          <div className="rounded-2xl border bg-card p-3">
            <p className="text-xs font-bold mb-1">{bn ? "সার্ভিস এলাকা" : "Service areas"}</p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {d.areas.map((a) => (
                <li key={a.id}>
                  {bn ? a.district?.name_bn || a.district?.name : a.district?.name}
                  {a.upazila ? ` · ${a.upazila}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-2xl border bg-card p-3">
          <p className="text-xs font-bold flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {bn ? "সময়সূচি" : "Schedule"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{scheduleSummary}</p>
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 border-t bg-background/95 backdrop-blur p-3 safe-bottom">
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            disabled={!windows.length || booking}
            onClick={() => setPickerOpen(true)}
            className="w-full rounded-xl bg-teal-700 text-white py-3 text-sm font-bold disabled:opacity-50"
          >
            {booking ? (
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            ) : bn ? (
              "স্লট বুক করুন"
            ) : (
              "Book a slot"
            )}
          </button>
        </div>
      </div>

      <TeleSlotPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        doctorId={doctorId}
        windows={windows}
        slotMinutes={d.visit_minutes || 30}
        fetchBookedStarts={fetchHomeDoctorBookedStarts}
        onConfirm={(slot) => void onSlotConfirm(slot)}
      />
    </div>
  );
}
