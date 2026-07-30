import { useEffect, useState } from "react";
import { type District } from "@/lib/api";
import { fetchUpazilaOptions } from "@/lib/upazilas";
import { useI18n } from "@/lib/i18n";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Upazila picker scoped to a selected district (DB-backed with catalog fallback) */
export function UpazilaSelect({
  district,
  value,
  onChange,
  variant = "default",
}: {
  district: District | null;
  value: string;
  onChange: (v: string) => void;
  /** `admin` = dark slate panel styles */
  variant?: "default" | "admin";
}) {
  const { lang } = useI18n();
  const [options, setOptions] = useState<{ en: string; bn: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const isAdmin = variant === "admin";

  useEffect(() => {
    if (!district) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchUpazilaOptions(district)
      .then((list) => {
        if (!cancelled) setOptions(list);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [district?.id, district?.slug]);

  return (
    <div className="relative">
      <select
        className={cn(
          "w-full appearance-none rounded-xl border px-3 py-2.5 pr-9 text-sm outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
          isAdmin
            ? "border-slate-700 bg-slate-950 text-slate-100 focus:ring-rose-500/40 [color-scheme:dark]"
            : "bg-background focus:ring-primary/25",
        )}
        value={value}
        disabled={!district || loading}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" className={isAdmin ? "bg-slate-950 text-slate-100" : undefined}>
          {!district
            ? lang === "bn"
              ? "আগে জেলা সিলেক্ট করুন"
              : "Select district first"
            : loading
              ? lang === "bn"
                ? "লোড হচ্ছে…"
                : "Loading…"
              : lang === "bn"
                ? "সব উপজেলা (ঐচ্ছিক)"
                : "All upazilas (optional)"}
        </option>
        {options.map((u) => (
          <option
            key={u.en}
            value={u.en}
            className={isAdmin ? "bg-slate-950 text-slate-100" : undefined}
          >
            {lang === "bn" ? u.bn : u.en}
          </option>
        ))}
      </select>
      <ChevronDown
        className={cn(
          "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2",
          isAdmin ? "text-slate-400" : "text-muted-foreground",
        )}
      />
    </div>
  );
}
