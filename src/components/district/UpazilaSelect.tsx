import { useEffect, useState } from "react";
import { type District } from "@/lib/api";
import { fetchUpazilaOptions } from "@/lib/upazilas";
import { useI18n } from "@/lib/i18n";
import { ChevronDown } from "lucide-react";

/** Upazila picker scoped to a selected district (DB-backed with catalog fallback) */
export function UpazilaSelect({
  district,
  value,
  onChange,
}: {
  district: District | null;
  value: string;
  onChange: (v: string) => void;
}) {
  const { lang } = useI18n();
  const [options, setOptions] = useState<{ en: string; bn: string }[]>([]);
  const [loading, setLoading] = useState(false);

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
        className="w-full appearance-none rounded-xl border bg-background px-3 py-2.5 pr-9 text-sm outline-none focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
        value={value}
        disabled={!district || loading}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">
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
          <option key={u.en} value={u.en}>
            {lang === "bn" ? u.bn : u.en}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
