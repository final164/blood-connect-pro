import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CareAiLabGeoPanel } from "@/components/care/CareAiLabGeoPanel";
import type { District } from "@/lib/api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  district: District | null;
  upazila: string;
  onDistrictChange: (d: District | null) => void;
  onUpazilaChange: (v: string) => void;
  title: string;
  hint: string;
  ctaLabel: string;
  cancelLabel: string;
  busy?: boolean;
  onContinue: () => void;
};

/** Bottom sheet: pick district + upazila before booking / price lookup. */
export function CareAiLabGeoSheet({
  open,
  onOpenChange,
  district,
  upazila,
  onDistrictChange,
  onUpazilaChange,
  title,
  hint,
  ctaLabel,
  cancelLabel,
  busy,
  onContinue,
}: Props) {
  const ready = !!district?.id;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl px-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="px-4 text-left space-y-1">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{hint}</SheetDescription>
        </SheetHeader>
        <div className="px-4 py-3">
          <CareAiLabGeoPanel
            district={district}
            upazila={upazila}
            onDistrictChange={onDistrictChange}
            onUpazilaChange={onUpazilaChange}
            title=""
            hint=""
            ctaLabel={ctaLabel}
            compact
          />
        </div>
        <SheetFooter className="px-4 gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={!ready || busy}
            onClick={onContinue}
            className="rounded-xl bg-sky-600 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? "…" : ctaLabel}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
