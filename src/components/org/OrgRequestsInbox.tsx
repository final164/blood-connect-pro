import { useEffect, useState } from "react";
import { Ban, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type OrgRequest = {
  id: string;
  patient_name: string;
  blood_group: string;
  hospital_name: string;
  status: string;
  urgency: string;
  notes: string | null;
  need_reason_label: string | null;
  contact_phone: string | null;
  created_at: string;
  city: string | null;
  area: string | null;
};

export function OrgRequestsInbox({
  orgId,
  lang,
  canEdit,
}: {
  orgId: string;
  lang: "bn" | "en";
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<OrgRequest[]>([]);
  const [filter, setFilter] = useState("open");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("blood_requests")
      .select(
        "id, patient_name, blood_group, hospital_name, status, urgency, notes, need_reason_label, contact_phone, created_at, city, area",
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    setLoading(false);
    if (error) {
      toast.error(error.message);
      setRows([]);
      return;
    }
    setRows((data as OrgRequest[]) ?? []);
  }

  useEffect(() => {
    void load();
  }, [orgId, filter]);

  async function setStatus(id: string, status: string) {
    if (!canEdit) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    const { error } = await supabase.from("blood_requests").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else void load();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center gap-2">
        <h3 className="text-sm font-semibold">
          {lang === "bn" ? "ইনবাউন্ড রিকোয়েস্ট" : "Inbound requests"}
        </h3>
        <select
          className="rounded-lg border bg-background px-2 py-1.5 text-xs"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="open">{lang === "bn" ? "ওপেন" : "Open"}</option>
          <option value="fulfilled">{lang === "bn" ? "পূর্ণ" : "Fulfilled"}</option>
          <option value="cancelled">{lang === "bn" ? "বাতিল" : "Cancelled"}</option>
          <option value="all">{lang === "bn" ? "সব" : "All"}</option>
        </select>
      </div>
      {loading && (
        <p className="text-xs text-muted-foreground py-6 text-center">
          {lang === "bn" ? "লোড হচ্ছে…" : "Loading…"}
        </p>
      )}
      {!loading && rows.length === 0 && (
        <p className="text-xs text-muted-foreground py-6 text-center">
          {lang === "bn" ? "কোনো রিকোয়েস্ট নেই" : "No requests"}
        </p>
      )}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border bg-card p-3 space-y-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  <span className="text-primary font-bold mr-1.5">{r.blood_group}</span>
                  {r.patient_name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {r.hospital_name} · {[r.area, r.city].filter(Boolean).join(", ")} · {r.status} ·{" "}
                  {r.urgency}
                </p>
                {(r.need_reason_label || r.notes) && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                    {[r.need_reason_label, r.notes].filter(Boolean).join(" · ")}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
                </p>
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => void setStatus(r.id, "fulfilled")}
                    className="h-8 w-8 rounded-lg bg-emerald-500/15 text-emerald-600 grid place-items-center"
                    title="Fulfilled"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void setStatus(r.id, "cancelled")}
                    className="h-8 w-8 rounded-lg bg-amber-500/15 text-amber-600 grid place-items-center"
                    title="Cancel"
                  >
                    <Ban className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
