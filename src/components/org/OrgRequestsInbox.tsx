import { useCallback, useEffect, useState } from "react";
import { Ban, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  fetchContactsForRequests,
  type CommunityRequestContact,
} from "@/lib/community-request-contacts";
import {
  RequestContactsExpandable,
  type RequestDetailRow,
} from "@/components/request/RequestContactsExpandable";

type OrgRequest = RequestDetailRow;

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
  const [contactsByReq, setContactsByReq] = useState<Record<string, CommunityRequestContact[]>>({});
  const [filter, setFilter] = useState("open");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    // Requests tagged to this org OR contacted via this org's donors
    const contactIdsP = supabase
      .from("community_request_contacts")
      .select("request_id")
      .eq("org_id", orgId)
      .limit(200);

    const directP = supabase
      .from("blood_requests")
      .select(
        "id, patient_name, blood_group, hospital_name, status, urgency, notes, need_reason_label, contact_phone, whatsapp_phone, created_at, city, area, bags_needed, from_community",
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100);

    const [contactRes, directRes] = await Promise.all([contactIdsP, directP]);

    let selectCols =
      "id, patient_name, blood_group, hospital_name, status, urgency, notes, need_reason_label, contact_phone, whatsapp_phone, created_at, city, area, bags_needed, from_community";

    if (directRes.error && /from_community|whatsapp_phone/i.test(directRes.error.message)) {
      selectCols =
        "id, patient_name, blood_group, hospital_name, status, urgency, notes, need_reason_label, contact_phone, created_at, city, area, bags_needed";
    } else if (directRes.error) {
      setLoading(false);
      toast.error(directRes.error.message);
      setRows([]);
      return;
    }

    const byId = new Map<string, OrgRequest>();
    for (const r of (directRes.data as OrgRequest[] | null) ?? []) byId.set(r.id, r);

    const extraIds = [
      ...new Set(
        ((contactRes.data ?? []) as { request_id: string }[])
          .map((c) => c.request_id)
          .filter((id) => !byId.has(id)),
      ),
    ];
    if (extraIds.length) {
      const { data: extra } = await supabase.from("blood_requests").select(selectCols).in("id", extraIds);
      for (const r of (extra as OrgRequest[] | null) ?? []) byId.set(r.id, r);
    }

    let list = [...byId.values()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    if (filter !== "all") list = list.filter((r) => r.status === filter);

    setRows(list);
    const allContacts = await fetchContactsForRequests(list.map((r) => r.id));
    // Prefer showing contacts for this org first, but keep all
    const filtered: Record<string, CommunityRequestContact[]> = {};
    for (const [reqId, listC] of Object.entries(allContacts)) {
      filtered[reqId] = listC.filter((c) => !c.org_id || c.org_id === orgId);
      if (!filtered[reqId].length) filtered[reqId] = listC;
    }
    setContactsByReq(filtered);
    setLoading(false);
  }, [orgId, filter]);

  useEffect(() => {
    void load();
  }, [load]);

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
      <p className="text-[11px] text-muted-foreground">
        {lang === "bn"
          ? "ক্লিক করে পোস্টের বিস্তারিত ও কন্টাক্ট করা ডোনার দেখুন। রক্ত দিয়েছে অ্যাসাইন করলে ডোনার ৩ মাস unavailable হবে।"
          : "Expand for full post + contacted donors. Mark donated → donor unavailable 3 months."}
      </p>
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
          <li key={r.id} className="space-y-1">
            <RequestContactsExpandable
              request={r}
              contacts={contactsByReq[r.id] ?? []}
              lang={lang}
              canAssign={canEdit}
              onAssigned={() => void load()}
            />
            {canEdit && (
              <div className="flex gap-1 px-1">
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
          </li>
        ))}
      </ul>
    </div>
  );
}
