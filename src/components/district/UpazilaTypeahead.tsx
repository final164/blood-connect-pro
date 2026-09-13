import { useEffect, useMemo, useRef, useState } from "react";
import { type District } from "@/lib/api";
import { fetchUpazilaOptions } from "@/lib/upazilas";
import { useI18n } from "@/lib/i18n";
import { MapPinned, X } from "lucide-react";
import { UPAZILA_ALL_SLOT } from "@/lib/blood-donor-ai-slots";

/** Sentinel value meaning whole district (all upazilas). */
export const UPAZILA_ALL = UPAZILA_ALL_SLOT;

/** Search autocomplete for upazilas scoped to a district */
export function UpazilaTypeahead({
  district,
  value,
  onChange,
  required,
  placeholder,
  allowAll = false,
  allLabel,
}: {
  district: District | null;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  /** Show “All upazilas” as first selectable option */
  allowAll?: boolean;
  allLabel?: string;
}) {
  const { lang, t } = useI18n();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<{ en: string; bn: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const resolvedAllLabel =
    allLabel ?? (lang === "bn" ? "সব উপজেলা" : "All upazilas");

  useEffect(() => {
    if (!value) {
      setQ("");
      return;
    }
    if (value === UPAZILA_ALL) {
      setQ(resolvedAllLabel);
      return;
    }
    const match = options.find((u) => u.en === value);
    setQ(match ? (lang === "bn" ? match.bn : match.en) : value);
  }, [value, lang, options, resolvedAllLabel]);

  useEffect(() => {
    if (!district) {
      setOptions([]);
      setQ("");
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

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle || needle === resolvedAllLabel.toLowerCase()) return options.slice(0, 40);
    return options
      .filter(
        (u) =>
          u.en.toLowerCase().includes(needle) ||
          u.bn.toLowerCase().includes(needle),
      )
      .slice(0, 40);
  }, [options, q, resolvedAllLabel]);

  const showAllInList =
    allowAll &&
    (() => {
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      return (
        resolvedAllLabel.toLowerCase().includes(needle) ||
        "all".startsWith(needle) ||
        "সব".startsWith(q.trim()) ||
        "সকল".startsWith(q.trim())
      );
    })();

  const label = placeholder ?? t("searchUpazila");
  const disabled = !district || loading;
  const listOpen = open && !disabled && (showAllInList || filtered.length > 0);

  return (
    <div ref={boxRef} className="relative">
      <div
        className={`flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/25 ${
          disabled ? "opacity-60" : ""
        }`}
      >
        <MapPinned className="h-4 w-4 text-primary shrink-0" />
        <input
          className="flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed"
          value={q}
          placeholder={
            !district
              ? lang === "bn"
                ? "আগে জেলা সিলেক্ট করুন"
                : "Select district first"
              : loading
                ? t("loading")
                : allowAll
                  ? lang === "bn"
                    ? "সব উপজেলা বা খুঁজুন…"
                    : "All or search upazila…"
                  : label
          }
          required={required && !value}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            if (value) onChange("");
          }}
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setQ("");
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {listOpen && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border bg-card shadow-lg">
          {showAllInList && (
            <li>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-primary/5 border-b"
                onClick={() => {
                  onChange(UPAZILA_ALL);
                  setQ(resolvedAllLabel);
                  setOpen(false);
                }}
              >
                <span className="font-semibold text-primary">{resolvedAllLabel}</span>
              </button>
            </li>
          )}
          {filtered.map((u) => (
            <li key={u.en}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-primary/5"
                onClick={() => {
                  onChange(u.en);
                  setQ(lang === "bn" ? u.bn : u.en);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{lang === "bn" ? u.bn : u.en}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {lang === "bn" ? u.en : u.bn}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
