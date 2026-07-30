import { Building2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { fetchHospitals, type Hospital } from "@/lib/api";

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w\u0980-\u09FF]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function customHospital(
  name: string,
  districtId?: string | null,
  districtSlug?: string | null,
  upazila?: string | null,
): Hospital {
  const trimmed = name.trim();
  return {
    id: `custom:${slugify(trimmed) || "entry"}`,
    name_bn: trimmed,
    name_en: trimmed,
    slug: slugify(trimmed) || "custom",
    district_id: districtId ?? null,
    district_slug: districtSlug ?? null,
    upazila: upazila ?? null,
    hospital_type: "private",
    is_active: true,
  };
}

function displayName(h: Hospital, lang: "bn" | "en") {
  return lang === "bn" ? h.name_bn : h.name_en;
}

/** Typeahead — catalog match or free-text custom hospital name */
export function HospitalTypeahead({
  value,
  onChange,
  districtId,
  districtSlug,
  upazila,
  required,
  placeholder,
}: {
  value: Hospital | null;
  onChange: (h: Hospital | null) => void;
  districtId?: string | null;
  districtSlug?: string | null;
  upazila?: string | null;
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
    if (value) setQ(displayName(value, lang));
  }, [value, lang]);

  useEffect(() => {
    let cancelled = false;
    if (!districtId && !districtSlug) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const list = await fetchHospitals({
          q,
          districtId: districtId ?? undefined,
          districtSlug: districtSlug ?? undefined,
          // No upazila → all hospitals across every upazila in the district
          upazila: upazila?.trim() || undefined,
          limit: upazila?.trim() ? 100 : 400,
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
  }, [q, districtId, districtSlug, upazila]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const label = useMemo(() => {
    if (placeholder) return placeholder;
    if (!districtId && !districtSlug) {
      return lang === "bn" ? "আগে জেলা সিলেক্ট করুন" : "Select district first";
    }
    return t("searchHospital");
  }, [placeholder, districtId, districtSlug, lang, t]);

  const disabled = !districtId && !districtSlug;
  const trimmed = q.trim();
  const exactInList = items.some((h) => displayName(h, lang).toLowerCase() === trimmed.toLowerCase());
  const showCustomOption = !!trimmed && !exactInList && !disabled;

  function pick(h: Hospital) {
    onChange(h);
    setQ(displayName(h, lang));
    setOpen(false);
  }

  function pickCustom() {
    if (!trimmed) return;
    pick(customHospital(trimmed, districtId, districtSlug, upazila));
  }

  function onBlurInput() {
    window.setTimeout(() => {
      if (!trimmed) return;
      if (value && displayName(value, lang).toLowerCase() === trimmed.toLowerCase()) return;
      if (exactInList) {
        const hit = items.find((h) => displayName(h, lang).toLowerCase() === trimmed.toLowerCase());
        if (hit) pick(hit);
        return;
      }
      pickCustom();
    }, 150);
  }

  const selectedLabel = value ? displayName(value, lang) : null;
  const isCustom = value?.id.startsWith("custom:");

  return (
    <div ref={boxRef} className="relative">
      <div
        className={`flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/25 ${
          disabled ? "opacity-60" : ""
        }`}
      >
        <Building2 className="h-4 w-4 text-primary shrink-0" />
        <input
          className="flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed"
          value={q}
          placeholder={label}
          required={required && !value}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onBlur={onBlurInput}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            if (value) onChange(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && showCustomOption) {
              e.preventDefault();
              pickCustom();
            }
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

      {selectedLabel && (
        <p className="mt-1.5 px-1 text-xs text-muted-foreground flex items-center gap-1.5">
          <Building2 className="h-3 w-3 shrink-0 text-primary/70" />
          <span>
            {lang === "bn" ? "নির্বাচিত" : "Selected"}:{" "}
            <span className="font-medium text-foreground">{selectedLabel}</span>
            {isCustom && (
              <span className="ml-1.5 text-[10px] uppercase tracking-wide text-primary/80">
                {lang === "bn" ? "কাস্টম" : "custom"}
              </span>
            )}
          </span>
        </p>
      )}

      {open && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border bg-card shadow-lg">
          {loading && (
            <li className="px-3 py-2.5 text-xs text-muted-foreground">
              {lang === "bn" ? "খুঁজছি…" : "Searching…"}
            </li>
          )}

          {!loading && showCustomOption && (
            <li>
              <button
                type="button"
                className="w-full px-3 py-2.5 text-left text-sm hover:bg-primary/5 border-b border-border/60"
                onMouseDown={(e) => e.preventDefault()}
                onClick={pickCustom}
              >
                <span className="text-muted-foreground text-xs">
                  {lang === "bn" ? "এই নাম ব্যবহার করুন" : "Use this name"}
                </span>
                <p className="font-medium text-foreground mt-0.5">{trimmed}</p>
              </button>
            </li>
          )}

          {!loading &&
            items.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-primary/5"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(h)}
                >
                  <span className="font-medium">{displayName(h, lang)}</span>
                  {h.upazila && !upazila?.trim() && (
                    <span className="ml-2 text-[10px] text-muted-foreground">{h.upazila}</span>
                  )}
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

          {!loading && !showCustomOption && items.length === 0 && !trimmed && (
            <li className="px-3 py-2.5 text-xs text-muted-foreground">
              {lang === "bn"
                ? "হাসপাতাল / ক্লিনিক / ডায়াগনস্টিক খুঁজুন…"
                : "Search hospital / clinic / diagnostic…"}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
