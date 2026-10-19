import { Download, FileSpreadsheet, MapPin, Upload, CheckCircle2 } from "lucide-react";

const STEPS = [
  {
    icon: Download,
    bn: { title: "স্যাম্পল ডাউনলোড", body: "CSV বা Excel টেমপ্লেট নিন — কলামগুলো ঠিক রাখুন।" },
    en: { title: "Download sample", body: "Get the CSV or Excel template — keep the columns intact." },
  },
  {
    icon: FileSpreadsheet,
    bn: { title: "ডেটা ভরুন", body: "নাম, ফোন, ব্লাড গ্রুপ — প্রতি সারিতে একজন রক্তদাতা।" },
    en: { title: "Fill the sheet", body: "Name, phone, blood group — one donor per row." },
  },
  {
    icon: MapPin,
    bn: { title: "জেলা নির্বাচন", body: "ইমপোর্টের আগে জেলা (ও উপজেলা) সিলেক্ট করুন।" },
    en: { title: "Pick district", body: "Select district (and upazila) before importing." },
  },
  {
    icon: Upload,
    bn: { title: "ফাইল আপলোড", body: "ফাইল বাছাই → প্রিভিউ দেখুন → ইমপোর্ট চাপুন।" },
    en: { title: "Upload file", body: "Choose file → review preview → hit Import." },
  },
] as const;

export function OrgBulkUploadGuide({
  lang,
  canImport,
  onGoImport,
}: {
  lang: "bn" | "en";
  canImport: boolean;
  onGoImport: () => void;
}) {
  return (
    <section className="rounded-2xl border bg-card overflow-hidden">
      <div className="border-b bg-linear-to-r from-primary/[0.08] via-transparent to-transparent px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Upload className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">
              {lang === "bn" ? "বাল্ক আপলোড কীভাবে করবেন" : "How to bulk upload donors"}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              {lang === "bn"
                ? "একসাথে শত শত রক্তদাতা যোগ করতে নিচের ধাপগুলো অনুসরণ করুন।"
                : "Follow these steps to add hundreds of donors at once."}
            </p>
          </div>
        </div>
      </div>

      <ol className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 sm:gap-3 sm:p-4">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const copy = lang === "bn" ? step.bn : step.en;
          return (
            <li
              key={step.en.title}
              className="relative flex flex-col gap-2 rounded-xl border bg-muted/30 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
                  {String(idx + 1).padStart(2, "0")}
                </span>
              </div>
              <p className="text-xs font-semibold leading-snug">{copy.title}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{copy.body}</p>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
        <a
          href="/samples/community-donors-sample.csv"
          download
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-muted"
        >
          <Download className="h-3.5 w-3.5" />
          CSV
        </a>
        <a
          href="/samples/community-donors-sample.xlsx"
          download
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-muted"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Excel
        </a>
        {canImport ? (
          <button
            type="button"
            onClick={onGoImport}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {lang === "bn" ? "রক্তদাতা ট্যাবে যান" : "Go to Donors tab"}
          </button>
        ) : (
          <p className="ml-auto text-[11px] text-muted-foreground">
            {lang === "bn" ? "ইমপোর্টের অনুমতি নেই" : "No import permission"}
          </p>
        )}
      </div>
    </section>
  );
}
