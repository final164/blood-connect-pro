import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { fetchTeleFormulary, type TeleFormularyItem } from "@/lib/tele-cms";
import {
  addTelePrescriptionItem,
  deleteTelePrescriptionItem,
  ensureTelePrescriptionDraft,
  fetchTelePrescription,
  saveTelePrescriptionAdvice,
  signTelePrescription,
  updateTelePrescriptionItem,
  type TelePrescription,
  type TelePrescriptionItem,
} from "@/lib/tele-prescription";

export function TeleRxEditor({ bookingId, doctorId }: { bookingId: string; doctorId: string }) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const [rx, setRx] = useState<TelePrescription | null>(null);
  const [items, setItems] = useState<TelePrescriptionItem[]>([]);
  const [formulary, setFormulary] = useState<TeleFormularyItem[]>([]);
  const [advice, setAdvice] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  async function reload() {
    const data = await ensureTelePrescriptionDraft(bookingId, doctorId);
    setRx(data.prescription);
    const fresh = await fetchTelePrescription(bookingId);
    setItems(fresh.items);
    setAdvice((bn ? fresh.prescription?.advice_bn : fresh.prescription?.advice_en) || "");
  }

  useEffect(() => {
    void reload().catch((e) => toast.error((e as Error).message));
    void fetchTeleFormulary(true).then(setFormulary);
  }, [bookingId, doctorId]);

  const locked = rx?.status === "signed";
  const suggestions = formulary.filter((f) => {
    const hay = `${f.name_bn} ${f.name_en}`.toLowerCase();
    return !q || hay.includes(q.toLowerCase());
  }).slice(0, 8);

  async function addFromFormulary(f: TeleFormularyItem) {
    if (!rx || locked) return;
    const item = await addTelePrescriptionItem(rx.id, {
      kind: f.kind,
      name: bn ? f.name_bn : f.name_en,
      strength: null,
      dose: f.default_dose,
      route: null,
      frequency: f.default_frequency,
      duration: f.default_duration,
      notes: null,
      sort_order: items.length * 10,
    });
    setItems((prev) => [...prev, item]);
    setQ("");
  }

  async function addBlank() {
    if (!rx || locked) return;
    const item = await addTelePrescriptionItem(rx.id, {
      kind: "medicine",
      name: q.trim() || (bn ? "ওষুধ" : "Medicine"),
      strength: null,
      dose: null,
      route: null,
      frequency: null,
      duration: null,
      notes: null,
      sort_order: items.length * 10,
    });
    setItems((prev) => [...prev, item]);
    setQ("");
  }

  async function sign() {
    if (!rx || locked) return;
    setBusy(true);
    try {
      await saveTelePrescriptionAdvice(rx.id, bn ? { advice_bn: advice } : { advice_en: advice });
      const signed = await signTelePrescription(rx.id);
      setRx(signed);
      toast.success(bn ? "প্রেসক্রিপশন সাইন হয়েছে" : "Prescription signed");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!rx) {
    return (
      <div className="py-6 grid place-items-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border p-3">
      <h3 className="text-sm font-bold">{bn ? "ইন্টারঅ্যাকটিভ প্রেসক্রিপশন" : "Interactive prescription"}</h3>
      {!locked && (
        <div className="space-y-1">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border px-3 py-2 text-xs"
              placeholder={bn ? "ফর্মুয়ারি খুঁজুন / নতুন নাম" : "Search formulary / new name"}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              type="button"
              onClick={() => void addBlank()}
              className="rounded-xl bg-sky-600 text-white px-3 text-xs font-semibold inline-flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
          {q && (
            <div className="rounded-xl border bg-background max-h-32 overflow-auto">
              {suggestions.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-muted"
                  onClick={() => void addFromFormulary(f)}
                >
                  [{f.kind}] {bn ? f.name_bn : f.name_en}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="space-y-1 rounded-xl bg-muted/40 px-2 py-2 text-xs">
            <div className="flex gap-2 items-start">
              <input
                className="flex-1 rounded-lg border bg-background px-2 py-1 font-semibold"
                disabled={locked}
                value={it.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, name } : x)));
                }}
                onBlur={() =>
                  void updateTelePrescriptionItem(it.id, { name: it.name }).catch((e) =>
                    toast.error((e as Error).message),
                  )
                }
              />
              {!locked && (
                <button
                  type="button"
                  onClick={() =>
                    void deleteTelePrescriptionItem(it.id).then(() =>
                      setItems((prev) => prev.filter((x) => x.id !== it.id)),
                    )
                  }
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                </button>
              )}
            </div>
            {!locked && (
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    ["dose", it.dose],
                    ["frequency", it.frequency],
                    ["duration", it.duration],
                  ] as const
                ).map(([key, val]) => (
                  <input
                    key={key}
                    className="rounded-lg border bg-background px-2 py-1 text-[10px]"
                    placeholder={key}
                    value={val ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, [key]: v } : x)));
                    }}
                    onBlur={() =>
                      void updateTelePrescriptionItem(it.id, {
                        [key]: (items.find((x) => x.id === it.id)?.[key] as string) || null,
                      }).catch((e) => toast.error((e as Error).message))
                    }
                  />
                ))}
              </div>
            )}
            {locked && (
              <p className="text-muted-foreground">
                {[it.dose, it.frequency, it.duration].filter(Boolean).join(" · ") || "—"}
              </p>
            )}
          </li>
        ))}
      </ul>

      <textarea
        className="w-full rounded-xl border px-3 py-2 text-xs"
        rows={2}
        disabled={locked}
        value={advice}
        onChange={(e) => setAdvice(e.target.value)}
        placeholder={bn ? "সাধারণ পরামর্শ" : "General advice"}
      />

      {!locked && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void sign()}
          className="w-full rounded-xl bg-emerald-600 text-white py-2 text-xs font-semibold inline-flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {bn ? "সাইন ও লক" : "Sign & lock"}
        </button>
      )}
      {locked && (
        <p className="text-[11px] text-emerald-700 font-medium">
          {bn ? "সাইন সম্পন্ন" : "Signed"} · {rx.signed_at}
        </p>
      )}
    </div>
  );
}
