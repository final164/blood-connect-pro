import { Stethoscope, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  customDoctor,
  doctorDisplayName,
  isCustomDoctor,
  searchCareDoctors,
  type CareDoctorOption,
} from "@/lib/care-doctors-api";

/**
 * Doctor picker in the same shape as the district / hospital selects: matches on
 * any substring, and optionally accepts a name that is not in the catalog yet.
 * A custom name only becomes a care_doctors row when the form is submitted, via
 * resolveDoctorId, so typing does not litter the table.
 */
export function DoctorTypeahead({
  value,
  onChange,
  orgId,
  allowCustom = true,
  required,
  placeholder,
  disabled,
}: {
  value: CareDoctorOption | null;
  onChange: (doctor: CareDoctorOption | null) => void;
  /** Doctors already at this clinic are listed first. */
  orgId?: string | null;
  allowCustom?: boolean;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CareDoctorOption[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) setQ(doctorDisplayName(value, lang));
  }, [value, lang]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const list = await searchCareDoctors(q, { orgId, limit: 20 });
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
  }, [q, orgId]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const trimmed = q.trim();
  const exactInList = items.some(
    (d) => doctorDisplayName(d, lang).toLowerCase() === trimmed.toLowerCase(),
  );
  const showCustomOption = allowCustom && !!trimmed && !exactInList && !disabled;

  function pick(doctor: CareDoctorOption) {
    onChange(doctor);
    setQ(doctorDisplayName(doctor, lang));
    setOpen(false);
  }

  function pickCustom() {
    if (!trimmed) return;
    pick(customDoctor(trimmed));
  }

  function onBlurInput() {
    window.setTimeout(() => {
      if (!trimmed) return;
      if (value && doctorDisplayName(value, lang).toLowerCase() === trimmed.toLowerCase()) return;
      const hit = items.find(
        (d) => doctorDisplayName(d, lang).toLowerCase() === trimmed.toLowerCase(),
      );
      if (hit) {
        pick(hit);
        return;
      }
      if (allowCustom) pickCustom();
    }, 150);
  }

  const custom = isCustomDoctor(value);

  return (
    <div ref={boxRef} className="relative">
      <div
        className={`flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/25 ${
          disabled ? "opacity-60" : ""
        }`}
      >
        <Stethoscope className="h-4 w-4 text-primary shrink-0" />
        <input
          className="flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed"
          value={q}
          placeholder={placeholder ?? (bn ? "ডাক্তারের নাম বা BMDC…" : "Doctor name or BMDC…")}
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

      {value && (
        <p className="mt-1.5 px-1 text-xs text-muted-foreground flex items-center gap-1.5">
          <Stethoscope className="h-3 w-3 shrink-0 text-primary/70" />
          <span>
            {bn ? "নির্বাচিত" : "Selected"}:{" "}
            <span className="font-medium text-foreground">{doctorDisplayName(value, lang)}</span>
            {custom && (
              <span className="ml-1.5 text-[10px] uppercase tracking-wide text-primary/80">
                {bn ? "নতুন" : "new"}
              </span>
            )}
          </span>
        </p>
      )}

      {open && !disabled && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border bg-card shadow-lg">
          {loading && (
            <li className="px-3 py-2.5 text-xs text-muted-foreground">
              {bn ? "খুঁজছি…" : "Searching…"}
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
                  {bn ? "এই নাম ব্যবহার করুন" : "Use this name"}
                </span>
                <p className="font-medium text-foreground mt-0.5">{trimmed}</p>
              </button>
            </li>
          )}

          {!loading &&
            items.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-primary/5"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(d)}
                >
                  <span className="font-medium">{doctorDisplayName(d, lang)}</span>
                  {d.bmdc_no && (
                    <span className="ml-2 text-[10px] text-muted-foreground">BMDC {d.bmdc_no}</span>
                  )}
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {bn ? d.specialty_name_bn : d.specialty_name_en}
                  </span>
                  {d.in_org ? (
                    <span className="ml-2 text-[10px] font-bold text-primary">
                      {bn ? "এই প্রতিষ্ঠানে" : "here"}
                    </span>
                  ) : d.org_count && d.org_count > 1 ? (
                    <span className="ml-2 text-[10px] text-muted-foreground">
                      {bn ? `${d.org_count}টি ক্লিনিক` : `${d.org_count} clinics`}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}

          {!loading && !showCustomOption && items.length === 0 && (
            <li className="px-3 py-2.5 text-xs text-muted-foreground">
              {bn ? "কোনো ডাক্তার পাওয়া যায়নি" : "No doctors found"}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
