import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, Loader2, Star, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { PhoneField } from "@/components/auth/PhoneField";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { getProfile } from "@/lib/api";
import { formatCareMoney } from "@/lib/care-invoice";
import { fetchTeleOfferCards, fetchTeleSettings, type TeleOfferCard, type TeleSettings } from "@/lib/tele-cms";
import {
  assignInstantDoctor,
  createTeleBooking,
  fetchTeleDoctor,
  searchTeleDoctors,
  setTelePayment,
  type TeleVideoDoctor,
} from "@/lib/tele-api";
import { authWithNext } from "@/lib/auth-next";

export function TeleCheckoutPage({
  mode,
  doctorId,
  specialtyId,
  offerId,
  slotStart,
  slotEnd,
}: {
  mode: "named" | "instant";
  doctorId?: string;
  specialtyId?: string;
  offerId?: string;
  slotStart?: string;
  slotEnd?: string;
}) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const { user, session, isAnonymous } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<TeleSettings | null>(null);
  const [offer, setOffer] = useState<TeleOfferCard | null>(null);
  const [doctor, setDoctor] = useState<TeleVideoDoctor | null>(null);
  const [pool, setPool] = useState<TeleVideoDoctor[]>([]);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchTeleSettings().then(setSettings);
    if (offerId) {
      void fetchTeleOfferCards(false).then((list) => setOffer(list.find((x) => x.id === offerId) ?? null));
    }
    if (doctorId) void fetchTeleDoctor(doctorId).then(setDoctor);
    if (mode === "instant") {
      void searchTeleDoctors({ instantOnly: true, specialtyId }).then((list) => setPool(list.slice(0, 4)));
    }
  }, [offerId, doctorId, mode, specialtyId]);

  useEffect(() => {
    if (!user?.id) return;
    void getProfile(user.id)
      .then((p) => {
        if (p?.phone) setPhone(String(p.phone));
        if (p?.full_name) setName(String(p.full_name));
      })
      .catch(() => undefined);
  }, [user?.id]);

  const fee = useMemo(() => {
    if (offer) return Number(offer.sale_price ?? 0);
    if (doctor?.fee_amount != null) return Number(doctor.fee_amount);
    return 0;
  }, [offer, doctor]);

  const vatPct = settings?.vat_percent ?? 5;
  const vat = Math.round(fee * (vatPct / 100) * 100) / 100;
  const net = Math.round((fee + vat) * 100) / 100;

  async function submit() {
    if (!session || isAnonymous) {
      const q = new URLSearchParams();
      if (mode) q.set("mode", mode);
      if (doctorId) q.set("doctorId", doctorId);
      if (specialtyId) q.set("specialtyId", specialtyId);
      if (offerId) q.set("offerId", offerId);
      if (slotStart) q.set("slotStart", slotStart);
      if (slotEnd) q.set("slotEnd", slotEnd);
      window.location.assign(authWithNext(`/care/video/checkout?${q.toString()}`));
      return;
    }
    if (mode === "named" && settings?.require_slot_for_named !== false && (!slotStart || !slotEnd)) {
      toast.error(bn ? "প্রথমে সময় স্লট বেছে নিন" : "Please select a time slot first");
      return;
    }
    setBusy(true);
    try {
      let booking = await createTeleBooking({
        mode,
        doctorId: mode === "named" ? doctorId : undefined,
        specialtyId: specialtyId || offer?.specialty_id || doctor?.specialty_id || undefined,
        offerCardId: offerId,
        slotStart,
        slotEnd,
        patientPhone: phone,
        patientName: name,
      });

      if (mode === "instant" && !booking.doctor_id) {
        try {
          booking = await assignInstantDoctor(booking.id);
        } catch {
          /* stay unassigned until a doctor comes online */
        }
      }

      // v1: mark paid manually (bKash/Nagad ops) — auto-waive zero fee
      if (booking.payment_status === "pending" && booking.net_amount > 0) {
        booking = await setTelePayment(booking.id, "paid");
      }

      toast.success(bn ? "বুকিং নিশ্চিত" : "Booking confirmed");
      void navigate({ to: "/care/video/booking/$id", params: { id: booking.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <AutoHideHeader className="z-30 border-b bg-background/90 backdrop-blur safe-top">
        <div className="flex items-center gap-2 px-3 py-2 max-w-3xl mx-auto w-full">
          <PageBackButton fallbackTo="/care/video" />
          <h1 className="text-sm font-bold">{bn ? "বুকিং" : "Checkout"}</h1>
        </div>
      </AutoHideHeader>

      <div className="px-3 py-4 max-w-3xl mx-auto grid gap-4 md:grid-cols-2 pb-10">
        <div className="space-y-4">
          <div className="rounded-2xl border p-4 space-y-3">
            <h2 className="text-sm font-bold inline-flex items-center gap-1.5">
              <UserPlus className="h-4 w-4" /> {bn ? "রোগীর তথ্য" : "Patient Info"}
            </h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={bn ? "নাম" : "Name"}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <PhoneField label={bn ? "মোবাইল" : "Mobile"} value={phone} onChange={setPhone} lang={lang} />
            <p className="text-[10px] text-muted-foreground">
              {bn ? "Terms ও Privacy-তে সম্মত হয়ে এগোন।" : "You agree to our Terms and Privacy Policy."}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="w-full rounded-xl bg-sky-600 text-white py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {bn ? settings?.ui.checkout_confirm_bn : settings?.ui.checkout_confirm_en}
            </button>
          </div>

          <div className="rounded-2xl border p-4 space-y-2 text-sm bg-white shadow-sm">
            <h2 className="font-bold">{bn ? "পেমেন্ট বিবরণ" : "Payment Details"}</h2>
            {slotStart && (
              <div className="rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-900">
                <p className="font-semibold">{bn ? "নির্বাচিত স্লট" : "Selected slot"}</p>
                <p>
                  {new Date(slotStart).toLocaleString(bn ? "bn-BD" : "en-US", {
                    timeZone: "Asia/Dhaka",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                  {slotEnd
                    ? ` – ${new Date(slotEnd).toLocaleTimeString(bn ? "bn-BD" : "en-US", {
                        timeZone: "Asia/Dhaka",
                        timeStyle: "short",
                      })}`
                    : ""}
                </p>
              </div>
            )}
            {(settings?.trust_bullets_bn?.length || settings?.trust_bullets_en?.length) ? (
              <ul className="space-y-1 text-[10px] text-muted-foreground">
                {(bn ? settings!.trust_bullets_bn : settings!.trust_bullets_en).map((t) => (
                  <li key={t} className="flex gap-1.5">
                    <Check className="h-3 w-3 text-emerald-600 shrink-0 mt-0.5" />
                    {t}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex justify-between text-xs">
              <span>{bn ? "কনসালটেশন ফি" : "Consultation Fee"}</span>
              <span>{formatCareMoney(fee)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>
                {bn ? "ভ্যাট" : "VAT"} ({vatPct}%)
              </span>
              <span>{formatCareMoney(vat)}</span>
            </div>
            <div className="flex justify-between font-bold border-t pt-2">
              <span>{bn ? "নেট" : "Net amount"}</span>
              <span>{formatCareMoney(net)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border p-4 space-y-3 bg-sky-50/40">
          <h2 className="text-sm font-bold">
            {mode === "instant"
              ? bn
                ? offer?.title_bn || "তাৎক্ষণিক ডাক্তার"
                : offer?.title_en || "Instant doctor"
              : bn
                ? doctor?.full_name_bn || doctor?.full_name
                : doctor?.full_name}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {mode === "instant"
              ? bn
                ? "প্ল্যাটফর্মের উচ্চ রেটেড ডাক্তারদের একজন বরাদ্দ হবে।"
                : "You will be assigned one of our highest-rated doctors."
              : bn
                ? "নির্ধারিত ডাক্তারের সাথে ভিডিও কনসালটেশন।"
                : "Video consultation with the selected doctor."}
          </p>
          {mode === "instant" && (
            <div className="flex gap-2 overflow-x-auto">
              {pool.map((d) => (
                <div key={d.doctor_id} className="relative h-14 w-14 shrink-0 rounded-xl overflow-hidden bg-muted">
                  {d.photo_url && <img src={d.photo_url} alt="" className="h-full w-full object-cover" />}
                  <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[8px] text-center py-0.5 inline-flex items-center justify-center gap-0.5">
                    <Star className="h-2 w-2 fill-amber-300 text-amber-300" />
                    {d.rating_avg || "5.0"}
                  </span>
                </div>
              ))}
            </div>
          )}
          <ul className="space-y-1.5 text-[11px]">
            {(bn ? settings?.trust_bullets_bn : settings?.trust_bullets_en)?.map((t) => (
              <li key={t} className="flex gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
