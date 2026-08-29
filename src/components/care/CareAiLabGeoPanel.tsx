import { MapPin } from "lucide-react";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { UpazilaSelect } from "@/components/district/UpazilaSelect";
import type { District } from "@/lib/api";

type Props = {
  district: District | null;
  upazila: string;
  onDistrictChange: (d: District | null) => void;
  onUpazilaChange: (v: string) => void;
  title?: string;
  hint?: string;
  ctaLabel?: string;
  onApply?: () => void;
  compact?: boolean;
};

export function CareAiLabGeoPanel({
  district,
  upazila,
  onDistrictChange,
  onUpazilaChange,
  title,
  hint,
  ctaLabel,
  onApply,
  compact,
}: Props) {
  const ready = !!district?.id;
  const showHeader = !!(title?.trim() || hint?.trim());
  return (
    <div
      className={`${showHeader ? "rounded-2xl border border-sky-500/30 bg-sky-500/5 " : ""}${
        showHeader ? (compact ? "px-3 py-2.5 space-y-2" : "px-3.5 py-3.5 space-y-3") : "space-y-2"
      }`}
    >
      {showHeader ? (
        <div className="flex items-start gap-2">
          <span className="mt-0.5 h-8 w-8 rounded-xl bg-sky-600/15 text-sky-700 grid place-items-center shrink-0">
            <MapPin className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            {title?.trim() ? <p className="text-sm font-semibold leading-snug">{title}</p> : null}
            {hint?.trim() ? (
              <p className="text-[11px] text-muted-foreground leading-relaxed">{hint}</p>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <DistrictTypeahead
          value={district}
          onChange={(d) => {
            onDistrictChange(d);
            onUpazilaChange("");
          }}
        />
        <UpazilaSelect district={district} value={upazila} onChange={onUpazilaChange} />
      </div>
      {onApply ? (
        <button
          type="button"
          disabled={!ready}
          onClick={onApply}
          className="w-full rounded-xl bg-sky-600 text-white px-3 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {ctaLabel}
        </button>
      ) : null}
    </div>
  );
}
