import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { locName } from "@/lib/care-cms";
import { useAuth } from "@/lib/auth-context";
import { bookBundlePlan, type BundleBookResult, type BundlePlan } from "@/lib/care-ai-bundle";

export function CareAiBundleSheet({
  open,
  onOpenChange,
  plan,
  lang,
  busy,
  setBusy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: BundlePlan | null;
  lang: "bn" | "en";
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const { session, isAnonymous } = useAuth();

  async function confirm() {
    if (!plan?.groups.length || busy) return;
    if (!session || isAnonymous) {
      void navigate({ to: "/auth", search: { next: "/care/ai-tests" } as never });
      return;
    }
    setBusy(true);
    try {
      const results: BundleBookResult[] = await bookBundlePlan(plan);
      const ok = results.filter((r) => r.ok);
      const fail = results.filter((r) => !r.ok);
      if (ok.length) {
        toast.success(
          lang === "bn"
            ? `বুকিং হয়েছে (${ok.length}) — My bookings-এ যান`
            : `Booked ${ok.length} test(s) — open My bookings`,
        );
      }
      if (fail.length) {
        toast.error(
          lang === "bn"
            ? `${fail.length}টি বুক হয়নি: ${fail.map((f) => f.name).join(", ")}`
            : `${fail.length} failed: ${fail.map((f) => f.name).join(", ")}`,
        );
      }
      if (ok.length) {
        onOpenChange(false);
        void navigate({ to: "/care", search: { tab: "bookings" } });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{lang === "bn" ? "বুকিং নিশ্চিত করুন" : "Confirm bookings"}</SheetTitle>
          <SheetDescription>
            {lang === "bn"
              ? "দাম ও ক্লিনিক দেখে নিশ্চিত করুন। নিশ্চিত না করা পর্যন্ত বুক হবে না।"
              : "Review clinics and prices. Nothing is booked until you confirm."}
          </SheetDescription>
        </SheetHeader>

        {!plan || plan.groups.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            {lang === "bn" ? "এই টেস্টগুলোর অফার পাওয়া যায়নি।" : "No priced offerings found for these tests."}
          </p>
        ) : (
          <div className="space-y-4 py-3">
            {plan.groups.map((g) => (
              <div key={g.orgId} className="rounded-xl border px-3 py-2.5 space-y-1.5">
                <p className="text-sm font-semibold">
                  {locName({ name: g.orgName, name_bn: g.orgNameBn }, lang)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    · {g.items.length} {lang === "bn" ? "টেস্ট" : "tests"}
                  </span>
                </p>
                <ul className="text-sm space-y-1">
                  {g.items.map((item) => (
                    <li key={item.offering.id} className="flex justify-between gap-2">
                      <span className="truncate">
                        {lang === "bn"
                          ? item.offering.catalog?.name_bn || item.offering.catalog?.code
                          : item.offering.catalog?.name_en || item.offering.catalog?.code}
                      </span>
                      <span className="tabular-nums shrink-0">৳{item.offering.price}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-right text-muted-foreground tabular-nums">
                  {lang === "bn" ? "সাবটোটাল" : "Subtotal"} ৳{g.subtotal}
                </p>
              </div>
            ))}
            {plan.uncovered.length > 0 && (
              <p className="text-xs text-amber-700">
                {lang === "bn"
                  ? `${plan.uncovered.length}টি টেস্ট কোনো ক্লিনিকে পাওয়া যায়নি।`
                  : `${plan.uncovered.length} test(s) not offered at listed clinics.`}
              </p>
            )}
            <p className="text-base font-bold text-right tabular-nums">
              {lang === "bn" ? "মোট" : "Total"} ৳{plan.total}
            </p>
          </div>
        )}

        <SheetFooter className="gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
          >
            {lang === "bn" ? "ফিরে যান" : "Back"}
          </button>
          <button
            type="button"
            disabled={busy || !plan?.groups.length}
            onClick={() => void confirm()}
            className="rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {busy
              ? lang === "bn"
                ? "বুক হচ্ছে…"
                : "Booking…"
              : lang === "bn"
                ? "বুকিং নিশ্চিত করুন"
                : "Confirm bookings"}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
