import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FlaskConical, LogOut, Microscope } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { careHasPermission, fetchMyCareMemberships, type CareMembership } from "@/lib/care-access";
import type { CarePermissionKey } from "@/lib/care-permissions";
import { fetchTestCatalog } from "@/lib/care-cms";
import {
  fetchOrgLabBookings,
  fetchOrgOfferings,
  generateLabDay,
  remainingSeats,
  fetchLabCalendars,
  reserveLabSlot,
  setLabBookingStatus,
} from "@/lib/care-lab-api";
import {
  clampDiscountPercent,
  offeringSalePrice,
} from "@/lib/care-lab-price";
import { CareLabPriceDisplay } from "@/components/care/CareLabPriceDisplay";
import { fetchOrgLocations } from "@/lib/care-api";
import { supabase } from "@/integrations/supabase/client";
import { CareLabInvoiceCard } from "@/components/care/CareLabInvoice";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type LabTab = "today" | "offerings" | "calendar" | "checkin";

type CareLabDeskPageProps = {
  portalMode?: boolean;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function CareLabDeskPage({ portalMode = false }: CareLabDeskPageProps) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { lang } = useI18n();
  const authPath = portalMode ? "/care/auth" : "/auth";
  const homePath = portalMode ? "/care/portal" : "/care";
  const [memberships, setMemberships] = useState<CareMembership[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [tab, setTab] = useState<LabTab>("today");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: authPath });
      return;
    }
    void fetchMyCareMemberships().then((rows) => {
      const active = rows.filter((r) => r.care_orgs?.is_active !== false);
      if (!active.length) {
        toast.error(lang === "bn" ? "ল্যাব মেম্বারশিপ নেই" : "No lab membership");
        void navigate({ to: portalMode ? "/care/auth" : "/care" });
        return;
      }
      setMemberships(active);
      setOrgId((prev) => prev ?? active[0]!.org_id);
      setReady(true);
    });
  }, [loading, user, navigate, lang, authPath, portalMode]);

  async function handleSignOut() {
    await signOut();
    void navigate({ to: authPath });
  }

  const membership = useMemo(() => memberships.find((m) => m.org_id === orgId) ?? null, [memberships, orgId]);
  const can = (key: CarePermissionKey) => careHasPermission(membership, key);
  const org = membership?.care_orgs;
  const orgName = lang === "bn" ? org?.name_bn || org?.name : org?.name;

  if (!ready || !orgId || !membership) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const tabs: { id: LabTab; label: string; show: boolean }[] = [
    { id: "today", label: lang === "bn" ? "আজকের বুকিং" : "Today", show: can("lab.checkin") || can("overview.view") },
    { id: "offerings", label: lang === "bn" ? "অফার" : "Offerings", show: can("lab.offerings") },
    { id: "calendar", label: lang === "bn" ? "ক্যালেন্ডার" : "Calendar", show: can("lab.calendar") },
    { id: "checkin", label: lang === "bn" ? "চেক-ইন" : "Check-in", show: can("lab.checkin") },
  ];

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Microscope className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {lang === "bn" ? "ল্যাব ডেস্ক" : "Lab desk"}
            </p>
            <h1 className="truncate text-base font-bold">{orgName}</h1>
          </div>
          {memberships.length > 1 && (
            <select className="max-w-40 rounded-xl border px-2 py-2 text-xs" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              {memberships.map((m) => (
                <option key={m.org_id} value={m.org_id}>
                  {lang === "bn" ? m.care_orgs?.name_bn || m.care_orgs?.name : m.care_orgs?.name}
                </option>
              ))}
            </select>
          )}
          <Link to={homePath} className="rounded-xl border px-2.5 py-2 text-xs font-medium">
            {portalMode ? (lang === "bn" ? "পোর্টাল" : "Portal") : lang === "bn" ? "কেয়ার" : "Care"}
          </Link>
          <button type="button" onClick={() => void handleSignOut()} className="h-9 w-9 grid place-items-center rounded-xl border">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  tab === t.id ? "bg-primary text-primary-foreground" : "border text-muted-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-4">
        {(tab === "today" || tab === "checkin") && (
          <TodayPanel orgId={orgId} canManage={can("lab.checkin")} lang={lang} />
        )}
        {tab === "offerings" && <OfferingsPanel orgId={orgId} lang={lang} />}
        {tab === "calendar" && <CalendarPanel orgId={orgId} lang={lang} />}
      </main>
    </div>
  );
}

function TodayPanel({
  orgId,
  canManage,
  lang,
}: {
  orgId: string;
  canManage: boolean;
  lang: "bn" | "en";
}) {
  const [date, setDate] = useState(todayIso());
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [guestName, setGuestName] = useState("");
  const [offeringId, setOfferingId] = useState("");
  const [offerings, setOfferings] = useState<{ id: string; label: string }[]>([]);
  const [invoiceBookingId, setInvoiceBookingId] = useState<string | null>(null);
  const [autoPrintInvoice, setAutoPrintInvoice] = useState(false);

  async function reload() {
    setRows((await fetchOrgLabBookings(orgId, date)) as Record<string, unknown>[]);
    const offs = (await fetchOrgOfferings(orgId)) as {
      id: string;
      care_test_catalog?: { code?: string; name_bn?: string; name_en?: string };
    }[];
    setOfferings(
      offs.map((o) => ({
        id: o.id,
        label: `${o.care_test_catalog?.code ?? ""} · ${lang === "bn" ? o.care_test_catalog?.name_bn : o.care_test_catalog?.name_en}`,
      })),
    );
    if (!offeringId && offs[0]) setOfferingId(offs[0].id);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, date]);

  async function walkIn() {
    if (!offeringId) return;
    try {
      const cals = await fetchLabCalendars(offeringId, date, date);
      let cal = cals[0];
      if (!cal) cal = await generateLabDay(offeringId, date);
      if (remainingSeats(cal) <= 0) throw new Error(lang === "bn" ? "ক্যাপাসিটি শেষ" : "Capacity full");
      const booking = await reserveLabSlot({ calendarId: cal.id, source: "walk_in", guestName: guestName || undefined });
      setGuestName("");
      setAutoPrintInvoice(true);
      setInvoiceBookingId(booking.id);
      toast.success(
        lang === "bn"
          ? `বুকিং ${booking.reference_code} · ইনভয়েস তৈরি`
          : `Booked ${booking.reference_code} · Invoice ready`,
      );
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" />
      <div className="flex flex-wrap gap-2">
        <select value={offeringId} onChange={(e) => setOfferingId(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
          {offerings.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder={lang === "bn" ? "নাম" : "Name"} className="rounded-xl border px-3 py-2 text-sm" />
        <button type="button" onClick={() => void walkIn()} className="rounded-xl bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold">
          {lang === "bn" ? "ওয়াক-ইন" : "Walk-in"}
        </button>
      </div>
      <ul className="divide-y rounded-2xl border bg-card">
        {rows.map((r) => {
          const cat = (r.care_test_offerings as { care_test_catalog?: { name_bn?: string; name_en?: string; code?: string } } | null)
            ?.care_test_catalog;
          return (
            <li key={String(r.id)} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="font-mono text-xs">{String(r.reference_code)}</span>
              {r.invoice_no ? (
                <span className="font-mono text-[10px] text-muted-foreground">{String(r.invoice_no)}</span>
              ) : null}
              <span className="flex-1 truncate">{lang === "bn" ? cat?.name_bn : cat?.name_en}</span>
              {r.price != null ? (
                <CareLabPriceDisplay
                  listPrice={
                    (r as { price_original?: number | null }).price_original != null &&
                    Number((r as { price_original?: number }).price_original) > Number(r.price)
                      ? Number((r as { price_original?: number }).price_original)
                      : Number(r.price)
                  }
                  salePrice={Number(r.price)}
                  discountPercent={(r as { discount_percent?: number | null }).discount_percent}
                  lang={lang}
                  variant="inline"
                  className="text-[11px]"
                />
              ) : null}
              <span className="text-[11px] text-muted-foreground">{String(r.status)}</span>
              <button
                type="button"
                className="text-[11px] font-semibold text-primary"
                onClick={() => {
                  setAutoPrintInvoice(false);
                  setInvoiceBookingId(String(r.id));
                }}
              >
                {lang === "bn" ? "ইনভয়েস" : "Invoice"}
              </button>
              {canManage && String(r.status) !== "completed" && String(r.status) !== "cancelled" && (
                <>
                  <button type="button" className="text-[11px] font-semibold" onClick={() => void setLabBookingStatus(String(r.id), "checked_in").then(reload)}>
                    {lang === "bn" ? "চেক-ইন" : "Check-in"}
                  </button>
                  <button type="button" className="text-[11px] font-semibold" onClick={() => void setLabBookingStatus(String(r.id), "sample_taken").then(reload)}>
                    {lang === "bn" ? "নমুনা" : "Sample"}
                  </button>
                  <button type="button" className="text-[11px] font-semibold" onClick={() => void setLabBookingStatus(String(r.id), "completed").then(reload)}>
                    {lang === "bn" ? "শেষ" : "Done"}
                  </button>
                  <button type="button" className="text-[11px] text-destructive" onClick={() => void setLabBookingStatus(String(r.id), "no_show").then(reload)}>
                    {lang === "bn" ? "নো-শো" : "No-show"}
                  </button>
                </>
              )}
            </li>
          );
        })}
        {rows.length === 0 && <li className="px-3 py-6 text-center text-xs text-muted-foreground">{lang === "bn" ? "বুকিং নেই" : "No bookings"}</li>}
      </ul>

      <Dialog
        open={!!invoiceBookingId}
        onOpenChange={(open) => {
          if (!open) {
            setInvoiceBookingId(null);
            setAutoPrintInvoice(false);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{lang === "bn" ? "টেস্ট বুকিং ইনভয়েস" : "Test booking invoice"}</DialogTitle>
          </DialogHeader>
          {invoiceBookingId && (
            <CareLabInvoiceCard
              bookingId={invoiceBookingId}
              canManagePayment={canManage}
              autoPrint={autoPrintInvoice}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OfferingsPanel({ orgId, lang }: { orgId: string; lang: "bn" | "en" }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [catalog, setCatalog] = useState<{ id: string; code: string; name_en: string; name_bn: string }[]>([]);
  const [locs, setLocs] = useState<{ id: string; name: string }[]>([]);
  const [catalogId, setCatalogId] = useState("");
  const [locId, setLocId] = useState("");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [cap, setCap] = useState("40");
  const [mode, setMode] = useState("day_quota");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editDisc, setEditDisc] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  async function reload() {
    setRows((await fetchOrgOfferings(orgId)) as Record<string, unknown>[]);
    const locations = (await fetchOrgLocations(orgId)) as { id: string; name: string }[];
    setLocs(locations);
    if (!locId && locations[0]) setLocId(locations[0].id);
  }

  useEffect(() => {
    void reload();
    void fetchTestCatalog().then((c) => {
      setCatalog(c);
      if (c[0]) setCatalogId(c[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const previewSale = offeringSalePrice({
    price: Number(price) || 0,
    discount_percent: clampDiscountPercent(discount),
  });

  async function add() {
    const list = Number(price);
    if (!Number.isFinite(list) || list < 0) {
      toast.error(lang === "bn" ? "সঠিক দাম দিন" : "Enter a valid price");
      return;
    }
    const disc = clampDiscountPercent(discount);
    const { error } = await supabase.from("care_test_offerings").insert({
      org_id: orgId,
      location_id: locId,
      catalog_id: catalogId,
      price: list,
      discount_percent: disc,
      booking_mode: mode,
      default_capacity: Number(cap) || 40,
    } as never);
    if (error) toast.error(error.message);
    else {
      toast.success(lang === "bn" ? "অফার যোগ হয়েছে" : "Offering added");
      setPrice("");
      setDiscount("");
      await reload();
    }
  }

  async function toggle(id: string, isActive: boolean) {
    const { error } = await supabase.from("care_test_offerings").update({ is_active: !isActive } as never).eq("id", id);
    if (error) toast.error(error.message);
    else await reload();
  }

  function startEdit(r: Record<string, unknown>) {
    setEditingId(String(r.id));
    setEditPrice(String(r.price ?? ""));
    setEditDisc(String(Number(r.discount_percent ?? 0) || ""));
  }

  async function saveEdit(id: string) {
    const list = Number(editPrice);
    if (!Number.isFinite(list) || list < 0) {
      toast.error(lang === "bn" ? "সঠিক দাম দিন" : "Enter a valid price");
      return;
    }
    const disc = clampDiscountPercent(editDisc);
    setSavingId(id);
    const { error } = await supabase
      .from("care_test_offerings")
      .update({ price: list, discount_percent: disc } as never)
      .eq("id", id);
    setSavingId(null);
    if (error) toast.error(error.message);
    else {
      toast.success(lang === "bn" ? "দাম ও ছাড় সেভ" : "Price & discount saved");
      setEditingId(null);
      await reload();
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border bg-card p-3 space-y-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          {lang === "bn" ? "নতুন টেস্ট অফার" : "New test offering"}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <select value={catalogId} onChange={(e) => setCatalogId(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {lang === "bn" ? c.name_bn : c.name_en}
              </option>
            ))}
          </select>
          <select value={locId} onChange={(e) => setLocId(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
            {locs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold text-muted-foreground">
              {lang === "bn" ? "মূল দাম (MRP) ৳" : "List price (MRP) ৳"}
            </span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              placeholder="500"
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold text-muted-foreground">
              {lang === "bn" ? "ছাড় %" : "Discount %"}
            </span>
            <input
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              inputMode="decimal"
              placeholder="0–100"
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>
          <input value={cap} onChange={(e) => setCap(e.target.value)} placeholder="capacity" className="rounded-xl border px-3 py-2 text-sm" />
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
            <option value="day_quota">{lang === "bn" ? "দৈনিক কোটা" : "Day quota"}</option>
            <option value="slot">{lang === "bn" ? "সময় স্লট" : "Time slot"}</option>
          </select>
        </div>
        {(Number(price) > 0 || clampDiscountPercent(discount) > 0) && (
          <div className="rounded-xl border border-dashed bg-muted/30 px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              {lang === "bn" ? "রোগী দেখবে" : "Patient sees"}
            </span>
            <CareLabPriceDisplay
              listPrice={Number(price) || 0}
              salePrice={previewSale}
              discountPercent={clampDiscountPercent(discount)}
              lang={lang}
              variant="inline"
            />
          </div>
        )}
        <button
          type="button"
          onClick={() => void add()}
          className="w-full sm:w-auto rounded-xl bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold"
        >
          {lang === "bn" ? "অফার যোগ" : "Add offering"}
        </button>
      </div>

      <ul className="space-y-2">
        {rows.map((r) => {
          const cat = r.care_test_catalog as { name_bn?: string; name_en?: string; code?: string } | null;
          const list = Number(r.price ?? 0);
          const disc = clampDiscountPercent(r.discount_percent);
          const isEditing = editingId === String(r.id);
          return (
            <li key={String(r.id)} className="rounded-xl border px-3 py-2.5 text-sm space-y-2">
              <div className="flex items-start gap-2">
                <FlaskConical className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">
                    {cat?.code} · {lang === "bn" ? cat?.name_bn : cat?.name_en}
                  </p>
                  {!isEditing ? (
                    <div className="mt-1">
                      <CareLabPriceDisplay
                        listPrice={list}
                        discountPercent={disc}
                        lang={lang}
                        variant="inline"
                      />
                    </div>
                  ) : (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {lang === "bn" ? "মূল দাম ৳" : "List ৳"}
                        </span>
                        <input
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-full rounded-lg border px-2.5 py-1.5 text-sm"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {lang === "bn" ? "ছাড় %" : "Discount %"}
                        </span>
                        <input
                          value={editDisc}
                          onChange={(e) => setEditDisc(e.target.value)}
                          className="w-full rounded-lg border px-2.5 py-1.5 text-sm"
                        />
                      </label>
                      <div className="sm:col-span-2">
                        <CareLabPriceDisplay
                          listPrice={Number(editPrice) || 0}
                          discountPercent={clampDiscountPercent(editDisc)}
                          lang={lang}
                          variant="inline"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {!isEditing ? (
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-primary hover:underline"
                      onClick={() => startEdit(r)}
                    >
                      {lang === "bn" ? "দাম/ছাড়" : "Price/%"}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={savingId === String(r.id)}
                        className="text-[11px] font-semibold text-emerald-700"
                        onClick={() => void saveEdit(String(r.id))}
                      >
                        {savingId === String(r.id)
                          ? lang === "bn"
                            ? "সেভ…"
                            : "Saving…"
                          : lang === "bn"
                            ? "সেভ"
                            : "Save"}
                      </button>
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground"
                        onClick={() => setEditingId(null)}
                      >
                        {lang === "bn" ? "বাতিল" : "Cancel"}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="text-[11px] font-semibold"
                    onClick={() => void toggle(String(r.id), !!r.is_active)}
                  >
                    {r.is_active ? (lang === "bn" ? "বন্ধ" : "Off") : lang === "bn" ? "চালু" : "On"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CalendarPanel({ orgId, lang }: { orgId: string; lang: "bn" | "en" }) {
  const [offerings, setOfferings] = useState<{ id: string; label: string }[]>([]);
  const [offeringId, setOfferingId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [cap, setCap] = useState("40");
  const [cals, setCals] = useState<Awaited<ReturnType<typeof fetchLabCalendars>>>([]);

  useEffect(() => {
    void fetchOrgOfferings(orgId).then((rows) => {
      const list = rows as {
        id: string;
        care_test_catalog?: { code?: string; name_bn?: string; name_en?: string };
      }[];
      setOfferings(
        list.map((o) => ({
          id: o.id,
          label: `${o.care_test_catalog?.code ?? ""} · ${lang === "bn" ? o.care_test_catalog?.name_bn : o.care_test_catalog?.name_en}`,
        })),
      );
      if (list[0]) setOfferingId(list[0].id);
    });
  }, [orgId, lang]);

  useEffect(() => {
    if (!offeringId) return;
    const to = new Date();
    to.setDate(to.getDate() + 14);
    void fetchLabCalendars(offeringId, todayIso(), to.toISOString().slice(0, 10)).then(setCals);
  }, [offeringId]);

  async function gen() {
    try {
      await generateLabDay(offeringId, date, Number(cap) || undefined);
      toast.success(lang === "bn" ? "ক্যালেন্ডার আপডেট" : "Calendar updated");
      const to = new Date();
      to.setDate(to.getDate() + 14);
      setCals(await fetchLabCalendars(offeringId, todayIso(), to.toISOString().slice(0, 10)));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select value={offeringId} onChange={(e) => setOfferingId(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
          {offerings.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" />
        <input value={cap} onChange={(e) => setCap(e.target.value)} className="w-24 rounded-xl border px-3 py-2 text-sm" />
        <button type="button" onClick={() => void gen()} className="rounded-xl bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold">
          {lang === "bn" ? "দিন খুলুন" : "Open day"}
        </button>
      </div>
      <ul className="space-y-1">
        {cals.map((c) => (
          <li key={c.id} className="rounded-xl border px-3 py-2 text-sm flex justify-between">
            <span>{c.cal_date}</span>
            <span className="text-xs text-muted-foreground">
              {c.reserved_count}/{c.capacity}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
