import { useEffect, useMemo, useState } from "react";
import { Plus, Scissors, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { fetchOrgLocations } from "@/lib/care-api";
import { resolveDoctorId, type CareDoctorOption } from "@/lib/care-doctors-api";
import { DoctorTypeahead } from "@/components/care/DoctorTypeahead";
import {
  addOperationOfferingDoctor,
  deleteOperationOffering,
  fetchOperationCatalog,
  fetchOrgOperationOfferings,
  operationDoctorRoleLabel,
  operationName,
  priceItemLabel,
  removeOperationOfferingDoctor,
  replaceOperationPriceItems,
  saveOperationOffering,
  type CareOperationCatalogItem,
  type CareOperationDoctorRole,
  type CareOperationOffering,
  type CareOperationPriceItem,
} from "@/lib/care-operations-api";

type OrgLocation = { id: string; name: string; name_bn: string | null };

type PriceDraft = { kind: CareOperationPriceItem["kind"]; label_bn: string; amount: string };

const PRICE_KINDS: CareOperationPriceItem["kind"][] = [
  "surgeon",
  "ot",
  "anesthesia",
  "bed",
  "investigation",
  "medicine",
  "other",
];

const DOCTOR_ROLES: CareOperationDoctorRole[] = [
  "lead_surgeon",
  "assistant",
  "anesthetist",
  "consultant",
];

function money(n: number, bn: boolean) {
  return `${bn ? "৳" : "BDT "}${n.toLocaleString("en-US")}`;
}

export function CareOperationOfferingsPanel({
  orgId,
  canEdit,
  lang,
}: {
  orgId: string;
  canEdit: boolean;
  lang: "bn" | "en";
}) {
  const bn = lang === "bn";
  const [catalog, setCatalog] = useState<CareOperationCatalogItem[]>([]);
  const [locations, setLocations] = useState<OrgLocation[]>([]);
  const [offerings, setOfferings] = useState<CareOperationOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const [cat, locs, offs] = await Promise.all([
        fetchOperationCatalog({ activeOnly: true }),
        fetchOrgLocations(orgId),
        fetchOrgOperationOfferings(orgId),
      ]);
      setCatalog(cat);
      setLocations((locs as unknown as OrgLocation[]) ?? []);
      setOfferings(offs);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <div className="h-7 w-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <Scissors className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold">{bn ? "অপারেশন ও মূল্য" : "Operations & pricing"}</h2>
          <p className="text-xs text-muted-foreground">
            {bn
              ? "প্যাকেজ মূল্য, ব্রেকডাউন ও সার্জন তালিকা"
              : "Package price, breakdown and surgeon list"}
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
          >
            {adding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {adding ? (bn ? "বাতিল" : "Cancel") : bn ? "নতুন" : "New"}
          </button>
        )}
      </div>

      {!locations.length && (
        <p className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
          {bn
            ? "আগে সেটিংস থেকে অন্তত একটি লোকেশন যোগ করুন।"
            : "Add at least one location from settings first."}
        </p>
      )}

      {adding && canEdit && !!locations.length && (
        <OfferingForm
          orgId={orgId}
          catalog={catalog}
          locations={locations}
          lang={lang}
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            void reload();
          }}
        />
      )}

      {!offerings.length && !adding && (
        <p className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
          {bn ? "এখনো কোনো অপারেশন যোগ করা হয়নি।" : "No operations added yet."}
        </p>
      )}

      <div className="space-y-2">
        {offerings.map((off) => (
          <OfferingRow
            key={off.id}
            orgId={orgId}
            offering={off}
            locations={locations}
            catalog={catalog}
            lang={lang}
            canEdit={canEdit}
            expanded={expanded === off.id}
            onToggle={() => setExpanded((prev) => (prev === off.id ? null : off.id))}
            onChanged={() => void reload()}
          />
        ))}
      </div>
    </div>
  );
}

function OfferingRow({
  orgId,
  offering,
  locations,
  catalog,
  lang,
  canEdit,
  expanded,
  onToggle,
  onChanged,
}: {
  orgId: string;
  offering: CareOperationOffering;
  locations: OrgLocation[];
  catalog: CareOperationCatalogItem[];
  lang: "bn" | "en";
  canEdit: boolean;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const bn = lang === "bn";
  const [editing, setEditing] = useState(false);
  const loc = locations.find((l) => l.id === offering.location_id);
  const breakdownTotal = (offering.price_items ?? []).reduce((sum, i) => sum + i.amount, 0);

  async function remove() {
    if (!window.confirm(bn ? "এই অপারেশনটি মুছে ফেলবেন?" : "Delete this operation?")) return;
    try {
      await deleteOperationOffering(offering.id);
      toast.success(bn ? "মুছে ফেলা হয়েছে" : "Deleted");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="rounded-2xl border bg-card">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-3 text-left">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{operationName(offering.catalog, lang)}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {bn ? loc?.name_bn || loc?.name : loc?.name}
            {offering.catalog?.code ? ` · ${offering.catalog.code}` : ""}
            {offering.doctors?.length ? ` · ${offering.doctors.length} ${bn ? "ডাক্তার" : "doctors"}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-primary">{money(offering.package_price, bn)}</p>
          {!offering.is_active && (
            <span className="text-[10px] font-semibold text-destructive">
              {bn ? "নিষ্ক্রিয়" : "inactive"}
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="space-y-3 border-t p-3">
          {editing ? (
            <OfferingForm
              orgId={orgId}
              catalog={catalog}
              locations={locations}
              lang={lang}
              existing={offering}
              onCancel={() => setEditing(false)}
              onSaved={() => {
                setEditing(false);
                onChanged();
              }}
            />
          ) : (
            <>
              {!!(offering.price_items ?? []).length && (
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {bn ? "মূল্য ব্রেকডাউন" : "Price breakdown"}
                  </p>
                  <ul className="space-y-1 text-xs">
                    {offering.price_items!.map((item) => (
                      <li key={item.id} className="flex justify-between">
                        <span>{priceItemLabel(item, lang)}</span>
                        <span className="font-medium">{money(item.amount, bn)}</span>
                      </li>
                    ))}
                  </ul>
                  {Math.abs(breakdownTotal - offering.package_price) > 0.5 && (
                    <p className="mt-1.5 text-[10px] text-amber-700">
                      {bn
                        ? `ব্রেকডাউনের যোগফল ${money(breakdownTotal, bn)} — প্যাকেজ মূল্যের সাথে মিলছে না`
                        : `Breakdown totals ${money(breakdownTotal, bn)}, which does not match the package price`}
                    </p>
                  )}
                </div>
              )}

              <OfferingDoctors
                offering={offering}
                orgId={orgId}
                lang={lang}
                canEdit={canEdit}
                onChanged={onChanged}
              />

              {canEdit && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="rounded-xl border px-3 py-2 text-xs font-semibold"
                  >
                    {bn ? "মূল্য সম্পাদনা" : "Edit pricing"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove()}
                    className="flex items-center gap-1.5 rounded-xl border border-destructive/40 px-3 py-2 text-xs font-semibold text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {bn ? "মুছুন" : "Delete"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function OfferingDoctors({
  offering,
  orgId,
  lang,
  canEdit,
  onChanged,
}: {
  offering: CareOperationOffering;
  orgId: string;
  lang: "bn" | "en";
  canEdit: boolean;
  onChanged: () => void;
}) {
  const bn = lang === "bn";
  const [doctor, setDoctor] = useState<CareDoctorOption | null>(null);
  const [role, setRole] = useState<CareOperationDoctorRole>("lead_surgeon");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!doctor) {
      toast.error(bn ? "ডাক্তার নির্বাচন করুন" : "Pick a doctor");
      return;
    }
    setBusy(true);
    try {
      const doctorId = await resolveDoctorId(doctor);
      await addOperationOfferingDoctor(
        offering.id,
        doctorId,
        role,
        (offering.doctors?.length ?? 0) * 10,
      );
      setDoctor(null);
      toast.success(bn ? "ডাক্তার যোগ হয়েছে" : "Doctor added");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await removeOperationOfferingDoctor(id);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {bn ? "সার্জন / ডাক্তার" : "Surgeons / doctors"}
      </p>
      {!offering.doctors?.length && (
        <p className="text-xs text-muted-foreground">
          {bn ? "কোনো ডাক্তার যোগ করা হয়নি" : "No doctors added"}
        </p>
      )}
      <ul className="space-y-1.5">
        {(offering.doctors ?? []).map((d) => (
          <li key={d.id} className="flex items-center gap-2 rounded-xl border px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">
                {(bn ? d.doctor?.full_name_bn : null) || d.doctor?.full_name || "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {operationDoctorRoleLabel(d.role, lang)}
                {d.doctor?.bmdc_no ? ` · BMDC ${d.doctor.bmdc_no}` : ""}
              </p>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => void remove(d.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="space-y-2 rounded-xl border border-dashed p-2.5">
          <DoctorTypeahead value={doctor} onChange={setDoctor} orgId={orgId} />
          <div className="flex gap-2">
            <select
              className="flex-1 rounded-xl border bg-background px-2 py-2 text-xs"
              value={role}
              onChange={(e) => setRole(e.target.value as CareOperationDoctorRole)}
            >
              {DOCTOR_ROLES.map((r) => (
                <option key={r} value={r}>
                  {operationDoctorRoleLabel(r, lang)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void add()}
              disabled={busy || !doctor}
              className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {bn ? "যোগ করুন" : "Add"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OfferingForm({
  orgId,
  catalog,
  locations,
  lang,
  existing,
  onCancel,
  onSaved,
}: {
  orgId: string;
  catalog: CareOperationCatalogItem[];
  locations: OrgLocation[];
  lang: "bn" | "en";
  existing?: CareOperationOffering;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const bn = lang === "bn";
  const [catalogId, setCatalogId] = useState(existing?.catalog_id ?? "");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [locationId, setLocationId] = useState(existing?.location_id ?? locations[0]?.id ?? "");
  const [packagePrice, setPackagePrice] = useState(
    existing ? String(existing.package_price) : "",
  );
  const [priceOriginal, setPriceOriginal] = useState(
    existing?.price_original != null ? String(existing.price_original) : "",
  );
  const [discount, setDiscount] = useState(
    existing?.discount_percent ? String(existing.discount_percent) : "",
  );
  const [priceNote, setPriceNote] = useState(existing?.price_note ?? "");
  const [includes, setIncludes] = useState(existing?.includes_bn ?? "");
  const [isActive, setIsActive] = useState(existing?.is_active !== false);
  const [items, setItems] = useState<PriceDraft[]>(
    (existing?.price_items ?? []).map((i) => ({
      kind: i.kind,
      label_bn: i.label_bn ?? "",
      amount: String(i.amount),
    })),
  );
  const [saving, setSaving] = useState(false);

  const filteredCatalog = useMemo(() => {
    const needle = catalogQuery.trim().toLowerCase();
    if (!needle) return catalog;
    return catalog.filter((c) =>
      [c.code, c.name_bn, c.name_en].filter(Boolean).join(" ").toLowerCase().includes(needle),
    );
  }, [catalog, catalogQuery]);

  const breakdownTotal = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  async function submit() {
    if (!catalogId) {
      toast.error(bn ? "অপারেশন নির্বাচন করুন" : "Pick an operation");
      return;
    }
    if (!locationId) {
      toast.error(bn ? "লোকেশন নির্বাচন করুন" : "Pick a location");
      return;
    }
    const price = Number(packagePrice);
    if (!Number.isFinite(price) || price <= 0) {
      toast.error(bn ? "সঠিক প্যাকেজ মূল্য দিন" : "Enter a valid package price");
      return;
    }
    setSaving(true);
    try {
      const offeringId = await saveOperationOffering({
        id: existing?.id,
        orgId,
        locationId,
        catalogId,
        packagePrice: price,
        priceOriginal: priceOriginal ? Number(priceOriginal) : null,
        discountPercent: discount ? Number(discount) : 0,
        priceNote: priceNote.trim() || null,
        includesBn: includes.trim() || null,
        isActive,
      });
      await replaceOperationPriceItems(
        offeringId,
        items
          .filter((i) => Number(i.amount) > 0)
          .map((i) => ({
            kind: i.kind,
            label_bn: i.label_bn.trim() || null,
            amount: Number(i.amount),
          })),
      );
      toast.success(bn ? "সংরক্ষিত হয়েছে" : "Saved");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-3">
      {!existing && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold">{bn ? "অপারেশন" : "Operation"}</label>
          <input
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            placeholder={bn ? "নাম বা কোড দিয়ে খুঁজুন…" : "Search by name or code…"}
            value={catalogQuery}
            onChange={(e) => setCatalogQuery(e.target.value)}
          />
          <select
            className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
            value={catalogId}
            onChange={(e) => setCatalogId(e.target.value)}
          >
            <option value="">{bn ? "— নির্বাচন করুন —" : "— select —"}</option>
            {filteredCatalog.map((c) => (
              <option key={c.id} value={c.id}>
                {bn ? c.name_bn || c.name_en : c.name_en || c.name_bn} ({c.code})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={bn ? "লোকেশন" : "Location"}>
          <select
            className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            disabled={!!existing}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {bn ? l.name_bn || l.name : l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={bn ? "প্যাকেজ মূল্য (৳)" : "Package price (BDT)"}>
          <input
            type="number"
            inputMode="decimal"
            className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
            value={packagePrice}
            onChange={(e) => setPackagePrice(e.target.value)}
          />
        </Field>
        <Field label={bn ? "আসল মূল্য (ঐচ্ছিক)" : "Original price (optional)"}>
          <input
            type="number"
            inputMode="decimal"
            className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
            value={priceOriginal}
            onChange={(e) => setPriceOriginal(e.target.value)}
          />
        </Field>
        <Field label={bn ? "ছাড় (%)" : "Discount (%)"}>
          <input
            type="number"
            inputMode="decimal"
            className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </Field>
      </div>

      <Field label={bn ? "মূল্য নোট" : "Price note"}>
        <input
          className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
          value={priceNote}
          onChange={(e) => setPriceNote(e.target.value)}
          placeholder={bn ? "যেমন: ঔষধ আলাদা" : "e.g. medicine billed separately"}
        />
      </Field>

      <Field label={bn ? "প্যাকেজে যা যা আছে" : "What the package includes"}>
        <textarea
          rows={2}
          className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
          value={includes}
          onChange={(e) => setIncludes(e.target.value)}
        />
      </Field>

      <div className="space-y-2 rounded-xl border border-dashed p-2.5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {bn ? "মূল্য ব্রেকডাউন (ঐচ্ছিক)" : "Price breakdown (optional)"}
          </p>
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, { kind: "surgeon", label_bn: "", amount: "" }])}
            className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold"
          >
            <Plus className="h-3 w-3" />
            {bn ? "লাইন" : "Line"}
          </button>
        </div>
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-1.5">
            <select
              className="w-28 rounded-xl border bg-background px-2 py-2 text-xs"
              value={item.kind}
              onChange={(e) =>
                setItems((prev) =>
                  prev.map((p, i) =>
                    i === idx ? { ...p, kind: e.target.value as PriceDraft["kind"] } : p,
                  ),
                )
              }
            >
              {PRICE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {priceItemLabel({ kind: k } as CareOperationPriceItem, lang)}
                </option>
              ))}
            </select>
            <input
              className="min-w-0 flex-1 rounded-xl border bg-background px-2 py-2 text-xs"
              placeholder={bn ? "লেবেল (ঐচ্ছিক)" : "Label (optional)"}
              value={item.label_bn}
              onChange={(e) =>
                setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, label_bn: e.target.value } : p)))
              }
            />
            <input
              type="number"
              inputMode="decimal"
              className="w-24 rounded-xl border bg-background px-2 py-2 text-xs"
              placeholder="0"
              value={item.amount}
              onChange={(e) =>
                setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, amount: e.target.value } : p)))
              }
            />
            <button
              type="button"
              onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {!!items.length && (
          <p className="text-[11px] text-muted-foreground">
            {bn ? "যোগফল" : "Total"}: <span className="font-semibold">{money(breakdownTotal, bn)}</span>
          </p>
        )}
      </div>

      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        {bn ? "রোগীদের কাছে দেখানো হবে" : "Visible to patients"}
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? (bn ? "সংরক্ষণ…" : "Saving…") : bn ? "সংরক্ষণ" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl border px-4 text-sm font-semibold">
          {bn ? "বাতিল" : "Cancel"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold">{label}</label>
      {children}
    </div>
  );
}
