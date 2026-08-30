import { useEffect, useMemo, useRef, useState } from "react";
import { fetchDistricts, type District } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Typeahead autocomplete for admin-managed districts */
export function DistrictTypeahead({
  value,
  onChange,
  required,
  placeholder,
  variant = "default",
  disabled,
}: {
  value: District | null;
  onChange: (d: District | null) => void;
  required?: boolean;
  placeholder?: string;
  /** `admin` = dark slate panel styles */
  variant?: "default" | "admin";
  disabled?: boolean;
}) {
  const { lang, t } = useI18n();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<District[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const isAdmin = variant === "admin";

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
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border px-3 py-2.5 focus-within:ring-2",
          isAdmin
            ? "border-slate-700 bg-slate-950 text-slate-100 focus-within:ring-rose-500/40"
            : "bg-background focus-within:ring-primary/25",
          disabled && "opacity-60 pointer-events-none",
        )}
      >
        <MapPin
          className={cn(
            "h-4 w-4 shrink-0",
            isAdmin ? "text-rose-400" : "text-primary",
          )}
        />
        <input
          className={cn(
            "flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed",
            isAdmin
              ? "text-slate-100 placeholder:text-slate-500"
              : "text-foreground placeholder:text-muted-foreground",
          )}
          value={q}
          placeholder={label}
          required={required && !value}
          disabled={disabled}
          onFocus={() => !disabled && setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            if (value) onChange(null);
          }}
          autoComplete="off"
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQ("");
            }}
            className={cn(
              isAdmin
                ? "text-slate-400 hover:text-white"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && !disabled && items.length > 0 && (
        <ul
          className={cn(
            "absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border shadow-lg",
            isAdmin
              ? "border-slate-700 bg-slate-900 text-slate-100"
              : "bg-card",
          )}
        >
          {items.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                className={cn(
                  "w-full px-3 py-2 text-left text-sm",
                  isAdmin ? "hover:bg-slate-800" : "hover:bg-primary/5",
                )}
                onClick={() => {
                  onChange(d);
                  setQ(lang === "bn" ? d.name_bn : d.name_en);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{lang === "bn" ? d.name_bn : d.name_en}</span>
                <span
                  className={cn(
                    "ml-2 text-xs",
                    isAdmin ? "text-slate-400" : "text-muted-foreground",
                  )}
                >
                  {lang === "bn" ? d.name_en : d.name_bn}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
