import { useEffect, useState } from "react";
import { Ban, CheckCircle2, Flag, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import { REPORT_CATEGORIES } from "@/components/settings/ReportProblemSheet";
import { toast } from "sonner";

type ReportRow = {
  id: string;
  user_id: string;
  category: string;
  subject: string;
  body: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  profiles?: { full_name: string | null; phone: string | null } | null;
};

const STATUSES = ["open", "in_progress", "resolved", "dismissed"] as const;

function statusLabel(s: string, lang: "bn" | "en") {
  const map: Record<string, { bn: string; en: string }> = {
    open: { bn: "নতুন", en: "Open" },
    in_progress: { bn: "চলমান", en: "In progress" },
    resolved: { bn: "সমাধান", en: "Resolved" },
    dismissed: { bn: "বাতিল", en: "Dismissed" },
  };
  const hit = map[s];
  if (!hit) return s;
  return lang === "bn" ? hit.bn : hit.en;
}

function categoryLabel(id: string, lang: "bn" | "en") {
  const hit = REPORT_CATEGORIES.find((c) => c.id === id);
  if (!hit) return id;
  return lang === "bn" ? hit.bn : hit.en;
}

export function ReportsAdmin() {
  const { t, lang } = useI18n();
  const { can } = useAdminAccess();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [filter, setFilter] = useState<string>("open");
  const [loading, setLoading] = useState(true);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    let q = supabase
      .from("user_reports")
      .select("id, user_id, category, subject, body, status, admin_notes, created_at, profiles(full_name, phone)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    setLoading(false);
    if (error) {
      toast.error(error.message);
      setRows([]);
      return;
    }
    setRows((data as unknown as ReportRow[]) ?? []);
  }

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("admin-user-reports")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_reports" }, () => {
        void load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on filter
  }, [filter]);

  async function setStatus(id: string, status: string) {
    if (!can("reports.edit")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    const notes = notesDraft[id];
    const patch: Record<string, unknown> = { status };
    if (typeof notes === "string") patch.admin_notes = notes.trim() || null;
    const { error } = await supabase.from("user_reports").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(t("saved"));
      void load();
    }
  }

  async function saveNotes(id: string) {
    if (!can("reports.edit")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    const notes = (notesDraft[id] ?? "").trim() || null;
    const { error } = await supabase.from("user_reports").update({ admin_notes: notes }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success(t("saved"));
  }

  async function remove(id: string) {
    if (!can("reports.delete")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    if (!confirm(lang === "bn" ? "রিপোর্ট মুছবেন?" : "Delete this report?")) return;
    const { error } = await supabase.from("user_reports").delete().eq("id", id);
    if (error) toast.error(error.message);
    else void load();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-rose-400" />
          <h2 className="text-sm font-semibold">
            {lang === "bn" ? "রিপোর্ট / অভিযোগ" : "Reports / complaints"}
          </h2>
        </div>
        <select
          className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="open">{statusLabel("open", lang)}</option>
          <option value="in_progress">{statusLabel("in_progress", lang)}</option>
          <option value="resolved">{statusLabel("resolved", lang)}</option>
          <option value="dismissed">{statusLabel("dismissed", lang)}</option>
          <option value="all">{lang === "bn" ? "সব" : "All"}</option>
        </select>
      </div>

      {loading && (
        <p className="text-sm text-slate-400 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("loading")}
        </p>
      )}

      {!loading && rows.length === 0 && (
        <p className="text-sm text-slate-400">
          {lang === "bn" ? "কোনো রিপোর্ট নেই" : "No reports"}
        </p>
      )}

      {rows.map((r) => {
        const name = r.profiles?.full_name || r.user_id.slice(0, 8);
        const phone = r.profiles?.phone;
        return (
          <div
            key={r.id}
            className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-2"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 mr-2">
                    {categoryLabel(r.category, lang)}
                  </span>
                  {r.subject}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {name}
                  {phone ? ` · ${phone}` : ""} · {statusLabel(r.status, lang)} ·{" "}
                  {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {can("reports.edit") && (
                  <>
                    <button
                      type="button"
                      onClick={() => void setStatus(r.id, "in_progress")}
                      className="p-2 rounded-lg bg-sky-500/15 text-sky-300"
                      title={statusLabel("in_progress", lang)}
                    >
                      <Loader2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void setStatus(r.id, "resolved")}
                      className="p-2 rounded-lg bg-emerald-500/15 text-emerald-300"
                      title={statusLabel("resolved", lang)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void setStatus(r.id, "dismissed")}
                      className="p-2 rounded-lg bg-amber-500/15 text-amber-300"
                      title={statusLabel("dismissed", lang)}
                    >
                      <Ban className="h-4 w-4" />
                    </button>
                  </>
                )}
                {can("reports.delete") && (
                  <button
                    type="button"
                    onClick={() => void remove(r.id)}
                    className="p-2 rounded-lg bg-rose-500/15 text-rose-300"
                    title={lang === "bn" ? "মুছুন" : "Delete"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{r.body}</p>
            {can("reports.edit") && (
              <div className="flex gap-2 items-start">
                <textarea
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs min-h-[60px]"
                  placeholder={lang === "bn" ? "অ্যাডমিন নোট…" : "Admin notes…"}
                  value={notesDraft[r.id] ?? r.admin_notes ?? ""}
                  onChange={(e) => setNotesDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                />
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => void saveNotes(r.id)}
                    className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-[10px] font-semibold hover:bg-slate-700"
                  >
                    {lang === "bn" ? "নোট সেভ" : "Save note"}
                  </button>
                  <select
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-[10px]"
                    value={r.status}
                    onChange={(e) => void setStatus(r.id, e.target.value)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s, lang)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            {!can("reports.edit") && r.admin_notes && (
              <p className="text-[10px] text-slate-500">
                {lang === "bn" ? "নোট: " : "Note: "}
                {r.admin_notes}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
