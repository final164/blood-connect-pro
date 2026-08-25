import type { AmbulanceOffering } from "@/lib/ambulance-api";

type ServiceType = { id: string; name_bn: string; name_en: string; slug?: string };

/** Single-select service type chips (Basic / ICU / Freezer …). */
export function AmbulanceServiceTypeSelect({
  types,
  offerings,
  value,
  onChange,
  lang,
}: {
  types: ServiceType[];
  offerings: AmbulanceOffering[];
  value: string;
  onChange: (id: string) => void;
  lang: "bn" | "en";
}) {
  const available =
    offerings.length > 0
      ? types.filter((t) => offerings.some((o) => o.service_type_id === t.id && o.is_active))
      : types;

  if (available.length === 0) {
    return (
      <p className="text-xs text-muted-foreground rounded-xl border border-dashed px-3 py-2">
        {lang === "bn" ? "সার্ভিস রেট সেট নেই" : "No service rates configured"}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-muted-foreground">
        {lang === "bn" ? "সার্ভিস টাইপ" : "Service type"}
      </p>
      <div className="flex flex-wrap gap-2">
        {available.map((t) => {
          const on = value === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={`rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition ${
                on
                  ? "border-orange-600 bg-orange-600 text-white shadow-sm"
                  : "border-orange-200/90 bg-background text-foreground hover:border-orange-400 hover:bg-orange-50/80"
              }`}
            >
              {lang === "bn" ? t.name_bn : t.name_en}
            </button>
          );
        })}
      </div>
    </div>
  );
}
