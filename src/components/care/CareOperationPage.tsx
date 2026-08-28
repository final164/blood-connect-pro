import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CalendarClock, Clock, Scissors, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { formatCareMoney } from "@/lib/care-invoice";
import { CareOrgChatButton } from "@/components/care/CareOrgChatButton";
import {
  fetchOperationOffering,
  operationDoctorRoleLabel,
  operationName,
  priceItemLabel,
  requestOperation,
  type CareOperationOffering,
} from "@/lib/care-operations-api";

export function CareOperationPage({ offeringId }: { offeringId: string }) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const navigate = useNavigate();
  const { user } = useAuth();
  const [offering, setOffering] = useState<CareOperationOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    setLoading(true);
    void fetchOperationOffering(offeringId)
      .then(setOffering)
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoading(false));
  }, [offeringId]);

  async function submit() {
    if (!user) {
      void navigate({ to: "/auth", search: { next: `/care/operation/${offeringId}` } as never });
      return;
    }
    if (!name.trim()) {
      toast.error(bn ? "রোগীর নাম দিন" : "Enter the patient name");
      return;
    }
    setBusy(true);
    try {
      const booking = await requestOperation({
        offeringId,
        requestedDate: date || null,
        guestName: name.trim(),
        guestPhone: phone.trim() || null,
        guestAge: age.trim() || null,
        guestSex: sex || null,
        guestAddress: address.trim() || null,
        patientNote: note.trim() || null,
        source: "app",
        doctorIds: (offering?.doctors ?? []).map((d) => d.doctor_id),
      });
      toast.success(bn ? "অনুরোধ পাঠানো হয়েছে" : "Request sent");
      void navigate({ to: "/care/operation-booking/$id", params: { id: booking.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const catalog = offering?.catalog;
  const prep = bn ? catalog?.prep_bn : catalog?.prep_en;
  const includes = bn ? offering?.includes_bn : offering?.includes_en;

  return (
    <div className="w-full">
      <AutoHideHeader className="z-30 border-b bg-background safe-top">
        <div className="flex items-center gap-2 px-3 py-2">
          <PageBackButton fallbackTo={{ to: "/care", search: { tab: "operations" } }} shape="xl" />
          <h1 className="flex-1 truncate text-sm font-bold">
            {offering ? operationName(catalog, lang) : bn ? "অপারেশন" : "Operation"}
          </h1>
          {offering?.org_id ? <CareOrgChatButton orgId={offering.org_id} variant="icon" /> : null}
        </div>
      </AutoHideHeader>

      <div className="mx-auto max-w-lg space-y-5 px-3 py-5">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">{bn ? "লোড হচ্ছে…" : "Loading…"}</p>
        ) : !offering ? (
          <p className="text-center text-sm text-muted-foreground">
            {bn ? "অপারেশন পাওয়া যায়নি" : "Operation not found"}
          </p>
        ) : (
          <>
            <section className="space-y-2 rounded-2xl border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Scissors className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold">{operationName(catalog, lang)}</h2>
                  <p className="text-xs text-muted-foreground">
                    {bn ? offering.org?.name_bn || offering.org?.name : offering.org?.name}
                    {offering.location
                      ? ` · ${bn ? offering.location.name_bn || offering.location.name : offering.location.name}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-end gap-2">
                <p className="text-2xl font-black text-primary">
                  {formatCareMoney(offering.package_price, lang)}
                </p>
                {offering.price_original && offering.price_original > offering.package_price ? (
                  <p className="pb-1 text-xs text-muted-foreground line-through">
                    {formatCareMoney(offering.price_original, lang)}
                  </p>
                ) : null}
              </div>
              {offering.price_note && (
                <p className="text-[11px] text-muted-foreground">{offering.price_note}</p>
              )}

              <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-muted-foreground">
                {catalog?.typical_duration_minutes ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {bn
                      ? `প্রায় ${catalog.typical_duration_minutes} মিনিট`
                      : `~${catalog.typical_duration_minutes} min`}
                  </span>
                ) : null}
                {catalog?.typical_stay_days ? (
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" />
                    {bn
                      ? `${catalog.typical_stay_days} দিন ভর্তি`
                      : `${catalog.typical_stay_days} day stay`}
                  </span>
                ) : null}
              </div>
            </section>

            {!!offering.price_items?.length && (
              <section className="rounded-2xl border bg-card p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {bn ? "মূল্য ব্রেকডাউন" : "Price breakdown"}
                </p>
                <ul className="space-y-1 text-sm">
                  {offering.price_items.map((item) => (
                    <li key={item.id} className="flex justify-between">
                      <span>{priceItemLabel(item, lang)}</span>
                      <span className="font-medium">{formatCareMoney(item.amount, lang)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {!!offering.doctors?.length && (
              <section className="rounded-2xl border bg-card p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {bn ? "সার্জন টিম" : "Surgical team"}
                </p>
                <ul className="space-y-1.5">
                  {offering.doctors.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 text-sm">
                      <Stethoscope className="h-4 w-4 text-primary" />
                      <span className="font-medium">
                        {(bn ? d.doctor?.full_name_bn : null) || d.doctor?.full_name || "—"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {operationDoctorRoleLabel(d.role, lang)}
                        {d.doctor?.bmdc_no ? ` · BMDC ${d.doctor.bmdc_no}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(includes || prep) && (
              <section className="space-y-2 rounded-2xl border bg-card p-4 text-sm">
                {includes && (
                  <p>
                    <b className="text-xs uppercase tracking-wide text-muted-foreground">
                      {bn ? "প্যাকেজে অন্তর্ভুক্ত" : "Package includes"}
                    </b>
                    <br />
                    {includes}
                  </p>
                )}
                {prep && (
                  <p>
                    <b className="text-xs uppercase tracking-wide text-muted-foreground">
                      {bn ? "প্রস্তুতি" : "Preparation"}
                    </b>
                    <br />
                    {prep}
                  </p>
                )}
              </section>
            )}

            <section className="space-y-3 rounded-2xl border bg-card p-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {bn ? "তারিখ অনুরোধ করুন" : "Request a date"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {bn
                    ? "ডেস্ক চূড়ান্ত তারিখ ও সময় নিশ্চিত করবে।"
                    : "The desk will confirm the final date and time."}
                </p>
              </div>

              <input
                type="date"
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
                value={date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
              />
              <input
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
                placeholder={bn ? "রোগীর নাম" : "Patient name"}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  className="rounded-xl border bg-background px-3 py-2.5 text-sm"
                  placeholder={bn ? "মোবাইল" : "Mobile"}
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <input
                  className="rounded-xl border bg-background px-3 py-2.5 text-sm"
                  placeholder={bn ? "বয়স" : "Age"}
                  inputMode="numeric"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
                <select
                  className="rounded-xl border bg-background px-2 py-2.5 text-sm"
                  value={sex}
                  onChange={(e) => setSex(e.target.value)}
                >
                  <option value="">{bn ? "লিঙ্গ" : "Sex"}</option>
                  <option value="M">{bn ? "পুরুষ" : "Male"}</option>
                  <option value="F">{bn ? "নারী" : "Female"}</option>
                  <option value="O">{bn ? "অন্যান্য" : "Other"}</option>
                </select>
              </div>
              <input
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
                placeholder={bn ? "ঠিকানা" : "Address"}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <textarea
                rows={2}
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
                placeholder={bn ? "রোগীর নোট (ঐচ্ছিক)" : "Patient note (optional)"}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy}
                className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {busy ? (bn ? "পাঠানো হচ্ছে…" : "Sending…") : bn ? "অনুরোধ পাঠান" : "Send request"}
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
