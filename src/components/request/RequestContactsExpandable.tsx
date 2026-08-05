import { useState } from "react";
import { ChevronDown, ChevronUp, Droplet, Phone } from "lucide-react";
import {
  channelLabel,
  markContactDonated,
  stripCommunityMetaFromNotes,
  type CommunityRequestContact,
} from "@/lib/community-request-contacts";
import { toast } from "sonner";

export type RequestDetailRow = {
  id: string;
  patient_name: string;
  blood_group: string;
  hospital_name: string;
  status: string;
  urgency: string;
  notes: string | null;
  need_reason_label?: string | null;
  contact_phone?: string | null;
  whatsapp_phone?: string | null;
  created_at: string;
  city?: string | null;
  area?: string | null;
  bags_needed?: number | null;
  from_community?: boolean | null;
};

export function RequestContactsExpandable({
  request: r,
  contacts,
  lang,
  variant = "card",
  canAssign = false,
  onAssigned,
}: {
  request: RequestDetailRow;
  contacts: CommunityRequestContact[];
  lang: "bn" | "en";
  variant?: "card" | "admin";
  canAssign?: boolean;
  onAssigned?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const cleanNotes = stripCommunityMetaFromNotes(r.notes);
  const isCommunity = !!r.from_community || contacts.length > 0;
  const isAdmin = variant === "admin";

  async function assignDonated(contactId: string) {
    if (!canAssign) return;
    const ok = confirm(
      lang === "bn"
        ? "এই ডোনারকে এই পোস্টের জন্য রক্ত দিয়েছেন হিসেবে মার্ক করবেন? ডোনার ৩ মাসের জন্য unavailable হবে।"
        : "Mark this donor as donated for this post? Donor will be unavailable for 3 months.",
    );
    if (!ok) return;
    setBusyId(contactId);
    const { error } = await markContactDonated(contactId, 1);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(
      lang === "bn"
        ? "ডোনার মার্ক হয়েছে — ৩ মাস unavailable"
        : "Donor marked — unavailable for 3 months",
    );
    onAssigned?.();
  }

  return (
    <div
      className={
        isAdmin
          ? "rounded-xl border border-slate-800 bg-slate-900 overflow-hidden"
          : "rounded-xl border bg-card overflow-hidden"
      }
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          isAdmin
            ? "w-full text-left p-3 flex items-start justify-between gap-2 hover:bg-slate-800/60 transition"
            : "w-full text-left p-3 flex items-start justify-between gap-2 hover:bg-muted/40 transition"
        }
      >
        <div className="min-w-0">
          <p className={`text-sm font-medium ${isAdmin ? "text-slate-100" : ""}`}>
            <span
              className={`font-bold mr-1.5 ${isAdmin ? "text-rose-400" : "text-primary"}`}
            >
              {r.blood_group}
            </span>
            {r.patient_name}
            {isCommunity && (
              <span
                className={`ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  isAdmin
                    ? "bg-sky-500/20 text-sky-300"
                    : "bg-primary/10 text-primary"
                }`}
              >
                Community
              </span>
            )}
            {contacts.length > 0 && (
              <span
                className={`ml-1.5 text-[10px] font-normal ${
                  isAdmin ? "text-slate-400" : "text-muted-foreground"
                }`}
              >
                · {contacts.length}{" "}
                {lang === "bn" ? "যোগাযোগ" : "contacted"}
              </span>
            )}
          </p>
          <p
            className={`text-[11px] truncate ${
              isAdmin ? "text-slate-400" : "text-muted-foreground"
            }`}
          >
            {r.hospital_name} · {[r.area, r.city].filter(Boolean).join(", ")} · {r.status} ·{" "}
            {r.urgency}
          </p>
        </div>
        <span
          className={`shrink-0 mt-0.5 ${isAdmin ? "text-slate-400" : "text-muted-foreground"}`}
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div
          className={
            isAdmin
              ? "border-t border-slate-800 px-3 py-3 space-y-3 text-xs text-slate-300"
              : "border-t px-3 py-3 space-y-3 text-xs text-muted-foreground"
          }
        >
          <div className="grid sm:grid-cols-2 gap-2">
            <Detail
              admin={isAdmin}
              label={lang === "bn" ? "রোগী" : "Patient"}
              value={`${r.patient_name} (${r.blood_group})`}
            />
            <Detail
              admin={isAdmin}
              label={lang === "bn" ? "ব্যাগ" : "Bags"}
              value={String(r.bags_needed ?? "—")}
            />
            <Detail
              admin={isAdmin}
              label={lang === "bn" ? "হাসপাতাল" : "Hospital"}
              value={r.hospital_name}
            />
            <Detail
              admin={isAdmin}
              label={lang === "bn" ? "স্থান" : "Place"}
              value={[r.area, r.city].filter(Boolean).join(", ") || "—"}
            />
            <Detail
              admin={isAdmin}
              label={lang === "bn" ? "কারণ" : "Reason"}
              value={r.need_reason_label || "—"}
            />
            <Detail
              admin={isAdmin}
              label={lang === "bn" ? "যোগাযোগ" : "Contact"}
              value={[r.contact_phone, r.whatsapp_phone].filter(Boolean).join(" / ") || "—"}
            />
            <Detail admin={isAdmin} label="Status" value={`${r.status} · ${r.urgency}`} />
            <Detail
              admin={isAdmin}
              label={lang === "bn" ? "সময়" : "Time"}
              value={r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
            />
          </div>
          {cleanNotes && (
            <div>
              <p
                className={`text-[10px] uppercase tracking-wide mb-1 ${
                  isAdmin ? "text-slate-500" : "opacity-70"
                }`}
              >
                {lang === "bn" ? "নোট" : "Notes"}
              </p>
              <p
                className={
                  isAdmin
                    ? "whitespace-pre-wrap leading-relaxed rounded-lg border border-slate-700 bg-slate-950/60 text-slate-200 px-2.5 py-2"
                    : "whitespace-pre-wrap leading-relaxed rounded-lg border bg-muted/30 px-2.5 py-2"
                }
              >
                {cleanNotes}
              </p>
            </div>
          )}

          <div>
            <p
              className={`text-[10px] uppercase tracking-wide mb-1.5 flex items-center gap-1 ${
                isAdmin ? "text-slate-500" : "opacity-70"
              }`}
            >
              <Phone className="h-3 w-3" />
              {lang === "bn" ? "যোগাযোগ করা ডোনার" : "Contacted donors"}
            </p>
            {contacts.length === 0 ? (
              <p className={`text-[11px] ${isAdmin ? "text-slate-500" : "opacity-60"}`}>
                {lang === "bn" ? "এখনো কোনো ডোনার কন্টাক্ট হয়নি" : "No donors contacted yet"}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {contacts.map((c) => (
                  <li
                    key={c.id}
                    className={
                      isAdmin
                        ? "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-950/50 px-2.5 py-2"
                        : "flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-2.5 py-2"
                    }
                  >
                    <div className="min-w-0">
                      <p
                        className={`font-medium text-xs truncate ${
                          isAdmin ? "text-slate-100" : "text-foreground"
                        }`}
                      >
                        {c.donor_name || "Donor"} · {c.donor_phone}
                      </p>
                      <p className={`text-[10px] ${isAdmin ? "text-slate-400" : "opacity-70"}`}>
                        {channelLabel(c.channel, lang)} ·{" "}
                        {c.outcome === "donated"
                          ? lang === "bn"
                            ? "রক্ত দিয়েছে"
                            : "Donated"
                          : lang === "bn"
                            ? "কন্টাক্ট"
                            : "Contacted"}
                        {" · "}
                        {new Date(c.created_at).toLocaleString()}
                        {c.donated_at && (
                          <>
                            {" · "}
                            {lang === "bn" ? "অ্যাসাইন" : "assigned"}{" "}
                            {new Date(c.donated_at).toLocaleDateString()}
                          </>
                        )}
                      </p>
                    </div>
                    {canAssign && c.outcome === "initiated" && c.channel !== "saved" && (
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => void assignDonated(c.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold px-2.5 py-1.5 disabled:opacity-50"
                      >
                        <Droplet className="h-3 w-3" fill="currentColor" />
                        {busyId === c.id
                          ? "…"
                          : lang === "bn"
                            ? "রক্ত দিয়েছে"
                            : "Mark donated"}
                      </button>
                    )}
                    {c.outcome === "donated" && (
                      <span className="text-[10px] font-semibold text-emerald-300">
                        ✓ {lang === "bn" ? "৩ মাস cooldown" : "3 mo cooldown"}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({
  label,
  value,
  admin,
}: {
  label: string;
  value: string;
  admin?: boolean;
}) {
  return (
    <div>
      <p className={`text-[10px] uppercase tracking-wide ${admin ? "text-slate-500" : "opacity-60"}`}>
        {label}
      </p>
      <p className={admin ? "text-slate-200" : "text-foreground/90"}>{value}</p>
    </div>
  );
}
