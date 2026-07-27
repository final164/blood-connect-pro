import { useEffect, useMemo, useRef, useState } from "react";
import { fetchDistricts, type District } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { MapPin, X } from "lucide-react";

/** Typeahead autocomplete for admin-managed districts */
export function DistrictTypeahead({
  value,
  onChange,
  required,
  placeholder,
}: {
  value: District | null;
  onChange: (d: District | null) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const { lang, t } = useI18n();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<District[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) setQ(lang === "bn" ? value.name_bn : value.name_en);
  }, [value, lang]);

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const list = await fetchDistricts(q);
        if (!cancelled) setItems(list);
      } catch {
        if (!cancelled) setItems([]);
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const label = useMemo(
    () => placeholder ?? t("searchDistrict"),
    [placeholder, t],
  );

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/25">
        <MapPin className="h-4 w-4 text-primary shrink-0" />
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
          <button type="button" onClick={() => { onChange(null); setQ(""); }} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && items.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border bg-card shadow-lg">
          {items.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-primary/5"
                onClick={() => {
                  onChange(d);
                  setQ(lang === "bn" ? d.name_bn : d.name_en);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{lang === "bn" ? d.name_bn : d.name_en}</span>
                <span className="ml-2 text-xs text-muted-foreground">{lang === "bn" ? d.name_en : d.name_bn}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
