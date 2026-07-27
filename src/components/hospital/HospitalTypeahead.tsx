import { Building2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { fetchHospitals, type Hospital } from "@/lib/api";

/** Typeahead autocomplete for admin-managed hospitals */
export function HospitalTypeahead({
  value,
  onChange,
  districtId,
  districtSlug,
  required,
  placeholder,
}: {
  value: Hospital | null;
  onChange: (h: Hospital | null) => void;
  districtId?: string | null;
  districtSlug?: string | null;
  required?: boolean;
  placeholder?: string;
}) {
  const { lang, t } = useI18n();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) setQ(lang === "bn" ? value.name_bn : value.name_en);
  }, [value, lang]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const list = await fetchHospitals({
          q,
          districtId: districtId ?? undefined,
          districtSlug: districtSlug ?? undefined,
          limit: 50,
        });
        if (!cancelled) setItems(list);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [q, districtId, districtSlug]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const label = useMemo(() => placeholder ?? t("searchHospital"), [placeholder, t]);

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/25">
        <Building2 className="h-4 w-4 text-primary shrink-0" />
        <input
          className="flex-1 bg-transparent text-sm outline-none"
          value={q}
          placeholder={label}
          required={required && !value}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            if (value) onChange(null);
          }}
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQ("");
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border bg-card shadow-lg">
          {loading && (
            <li className="px-3 py-2.5 text-xs text-muted-foreground">
              {lang === "bn" ? "খুঁজছি…" : "Searching…"}
            </li>
          )}
          {!loading && items.length === 0 && (
            <li className="px-3 py-2.5 text-xs text-muted-foreground">
              {lang === "bn" ? "কোনো হাসপাতাল পাওয়া যায়নি — জেলা সিলেক্ট করে আবার লিখুন" : "No hospitals found — select a district and try again"}
            </li>
          )}
          {!loading &&
            items.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-primary/5"
                  onClick={() => {
                    onChange(h);
                    setQ(lang === "bn" ? h.name_bn : h.name_en);
                    setOpen(false);
                  }}
                >
                  <span className="font-medium">{lang === "bn" ? h.name_bn : h.name_en}</span>
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {h.hospital_type === "government"
                      ? t("government")
                      : h.hospital_type === "diagnostic"
                        ? t("diagnostic")
                        : h.hospital_type === "clinic"
                          ? t("clinic")
                          : t("private")}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
