import { useEffect, useState } from "react";
import { Flag, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

const field =
  "w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/25 placeholder:text-muted-foreground/70";

export const REPORT_CATEGORIES = [
  { id: "complaint", bn: "অভিযোগ", en: "Complaint" },
  { id: "bug", bn: "বাগ / সমস্যা", en: "Bug / problem" },
  { id: "abuse", bn: "অপব্যবহার / হয়রানি", en: "Abuse / harassment" },
  { id: "spam", bn: "স্প্যাম", en: "Spam" },
  { id: "suggestion", bn: "পরামর্শ", en: "Suggestion" },
  { id: "other", bn: "অন্যান্য", en: "Other" },
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number]["id"];

export function ReportProblemSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { lang, t } = useI18n();
  const { user } = useAuth();
  const [category, setCategory] = useState<ReportCategory>("complaint");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategory("complaint");
    setSubject("");
    setBody("");
    setBusy(false);
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id) {
      return toast.error(lang === "bn" ? "লগইন প্রয়োজন" : "Login required");
    }
    const sub = subject.trim();
    const msg = body.trim();
    if (!sub) {
      return toast.error(lang === "bn" ? "বিষয় লিখুন" : "Enter a subject");
    }
    if (msg.length < 10) {
      return toast.error(
        lang === "bn" ? "বিস্তারিত কমপক্ষে ১০ অক্ষর লিখুন" : "Details must be at least 10 characters",
      );
    }

    setBusy(true);
    const { error } = await supabase.from("user_reports").insert({
      user_id: user.id,
      category,
      subject: sub.slice(0, 200),
      body: msg.slice(0, 4000),
      status: "open",
    });
    setBusy(false);

    if (error) return toast.error(error.message);

    toast.success(
      lang === "bn"
        ? "রিপোর্ট পাঠানো হয়েছে — অ্যাডমিন দেখতে পাবে"
        : "Report submitted — admins will see it",
    );
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="fixed inset-x-0 top-0 z-10 mx-auto w-full sm:max-w-lg max-h-[92dvh] flex flex-col overflow-hidden rounded-b-2xl border border-t-0 bg-background shadow-xl animate-top-sheet-down safe-top">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Flag className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold truncate">
                {lang === "bn" ? "রিপোর্ট / অভিযোগ" : "Report / complain"}
              </h2>
              <p className="text-[11px] text-muted-foreground truncate">
                {lang === "bn"
                  ? "সমস্যা বা অভিযোগ অ্যাডমিন প্যানেলে যাবে"
                  : "Your report goes to the admin panel"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-xl grid place-items-center text-muted-foreground hover:bg-muted shrink-0"
            aria-label={t("cancel")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void submit(e)} className="p-4 space-y-3 overflow-y-auto min-h-0 flex-1 pb-8">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {lang === "bn" ? "ধরন" : "Category"}
            </label>
            <select
              className={field}
              value={category}
              onChange={(e) => setCategory(e.target.value as ReportCategory)}
            >
              {REPORT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {lang === "bn" ? c.bn : c.en}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {lang === "bn" ? "বিষয়" : "Subject"}
            </label>
            <input
              className={field}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={lang === "bn" ? "সংক্ষেপে লিখুন…" : "Short summary…"}
              maxLength={200}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {lang === "bn" ? "বিস্তারিত" : "Details"}
            </label>
            <textarea
              className={field}
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                lang === "bn"
                  ? "কী সমস্যা হয়েছে বিস্তারিত লিখুন…"
                  : "Describe what happened…"
              }
              maxLength={4000}
              required
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy
              ? t("saving")
              : lang === "bn"
                ? "রিপোর্ট পাঠান"
                : "Submit report"}
          </button>
        </form>
      </div>
    </div>
  );
}
