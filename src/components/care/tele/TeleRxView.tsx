import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { fetchTelePrescription, type TelePrescriptionItem } from "@/lib/tele-prescription";

export function TeleRxView({ bookingId }: { bookingId: string }) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const [items, setItems] = useState<TelePrescriptionItem[]>([]);
  const [signed, setSigned] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);

  useEffect(() => {
    void fetchTelePrescription(bookingId).then(({ prescription, items: rows }) => {
      setItems(rows);
      setSigned(prescription?.status === "signed");
      setAdvice(bn ? prescription?.advice_bn : prescription?.advice_en);
    });
  }, [bookingId, bn]);

  if (!signed && items.length === 0) return null;

  return (
    <div className="rounded-2xl border p-4 space-y-3 print:border-0" id="tele-rx-print">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">{bn ? "প্রেসক্রিপশন" : "Prescription"}</h2>
        {signed && (
          <button
            type="button"
            className="text-[10px] font-semibold text-sky-600"
            onClick={() => window.print()}
          >
            {bn ? "প্রিন্ট / PDF" : "Print / PDF"}
          </button>
        )}
      </div>
      {!signed && (
        <p className="text-[11px] text-muted-foreground">{bn ? "ডাক্তার এখনও সাইন করেননি।" : "Doctor has not signed yet."}</p>
      )}
      <ol className="space-y-2 text-xs">
        {items.map((it, i) => (
          <li key={it.id} className="rounded-xl bg-muted/40 px-3 py-2">
            <p className="font-semibold">
              {i + 1}. [{it.kind}] {it.name}
              {it.strength ? ` (${it.strength})` : ""}
            </p>
            <p className="text-muted-foreground">
              {[it.dose, it.frequency, it.duration, it.route].filter(Boolean).join(" · ")}
            </p>
            {it.notes && <p className="text-muted-foreground mt-0.5">{it.notes}</p>}
          </li>
        ))}
      </ol>
      {advice && <p className="text-xs border-t pt-2 whitespace-pre-wrap">{advice}</p>}
    </div>
  );
}
