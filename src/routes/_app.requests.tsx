import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { timeAgo, BLOOD_GROUPS } from "@/lib/format";
import { Plus, MapPin, Phone, Clock, X, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

type Req = {
  id: string;
  requester_id: string;
  patient_name: string;
  blood_group: string;
  bags_needed: number;
  hospital_name: string;
  city: string;
  area: string | null;
  contact_phone: string;
  needed_by: string;
  urgency: "normal" | "urgent" | "critical";
  notes: string | null;
  status: string;
  created_at: string;
};

export const Route = createFileRoute("/_app/requests")({
  head: () => ({ meta: [{ title: "Requests — BloodLink" }] }),
  component: RequestsPage,
});

function RequestsPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [items, setItems] = useState<Req[]>([]);
  const [filter, setFilter] = useState<string>("ALL");
  const [openNew, setOpenNew] = useState(false);

  async function load() {
    let q = supabase
      .from("blood_requests")
      .select("*")
      .eq("status", "open")
      .order("urgency", { ascending: false })
      .order("needed_by", { ascending: true });
    if (filter !== "ALL") q = q.eq("blood_group", filter as (typeof BLOOD_GROUPS)[number]);
    const { data } = await q;
    setItems((data ?? []) as Req[]);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("req-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "blood_requests" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="mx-auto max-w-md">
      <header className="sticky top-0 z-30 glass border-b safe-top">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-base font-bold">{t("requests")}</h1>
          <button
            onClick={() => setOpenNew(true)}
            className="rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("createRequest")}
          </button>
        </div>
        <div className="px-3 pb-2 flex gap-1 overflow-x-auto no-scrollbar">
          {["ALL", ...BLOOD_GROUPS].map((g) => (
            <button
              key={g}
              onClick={() => setFilter(g)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium border ${
                filter === g ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card text-muted-foreground"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </header>

      <ul className="p-3 space-y-2.5">
        {items.length === 0 && (
          <li className="text-center text-sm text-muted-foreground py-16">{t("emptyRequests")}</li>
        )}
        {items.map((r) => (
          <li
            key={r.id}
            className="rounded-2xl border bg-card p-3 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div
                className={`shrink-0 h-14 w-14 rounded-2xl grid place-items-center font-bold text-lg ${
                  r.urgency === "critical"
                    ? "bg-destructive text-destructive-foreground"
                    : r.urgency === "urgent"
                    ? "bg-[color:var(--urgent)] text-white"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {r.blood_group}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold truncate">{r.patient_name}</p>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      r.urgency === "critical"
                        ? "bg-destructive/10 text-destructive"
                        : r.urgency === "urgent"
                        ? "bg-[color:var(--urgent)]/10 text-[color:var(--urgent)]"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {t(r.urgency)}
                  </span>
                </div>
                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {r.hospital_name}, {r.city}
                  </p>
                  <p className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(r.needed_by).toLocaleString(lang === "bn" ? "bn-BD" : "en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <a
                    href={`tel:${r.contact_phone}`}
                    className="flex-1 rounded-full bg-primary/10 text-primary text-xs font-semibold py-1.5 flex items-center justify-center gap-1"
                  >
                    <Phone className="h-3 w-3" />
                    {t("respond")}
                  </a>
                  {r.requester_id !== user?.id && (
                    <Link
                      to="/chat/$peerId"
                      params={{ peerId: r.requester_id }}
                      className="rounded-full bg-muted text-foreground text-xs font-semibold px-3 py-1.5 flex items-center gap-1"
                    >
                      <MessageCircle className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground">{timeAgo(r.created_at, lang)}</span>
            </div>
          </li>
        ))}
      </ul>

      {openNew && <NewRequestSheet onClose={() => setOpenNew(false)} onCreated={load} />}
    </div>
  );
}

function NewRequestSheet({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    patient_name: "",
    blood_group: "O+" as (typeof BLOOD_GROUPS)[number],
    bags_needed: 1,
    hospital_name: "",
    city: "",
    area: "",
    contact_phone: "",
    needed_by: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
    urgency: "normal" as "normal" | "urgent" | "critical",
    notes: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("blood_requests").insert({
      ...form,
      requester_id: user.id,
      needed_by: new Date(form.needed_by).toISOString(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Request posted");
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card rounded-t-3xl sm:rounded-3xl p-4 max-h-[90dvh] overflow-y-auto safe-bottom"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold">{t("createRequest")}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2.5">
          <Input label={t("patientName")} value={form.patient_name} onChange={(v) => setForm({ ...form, patient_name: v })} required />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">{t("bloodGroup")}</label>
              <select
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
                value={form.blood_group}
                onChange={(e) => setForm({ ...form, blood_group: e.target.value as (typeof BLOOD_GROUPS)[number] })}
              >
                {BLOOD_GROUPS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <Input
              label={t("bagsNeeded")}
              type="number"
              value={String(form.bags_needed)}
              onChange={(v) => setForm({ ...form, bags_needed: Math.max(1, Number(v) || 1) })}
            />
          </div>
          <Input label={t("hospital")} value={form.hospital_name} onChange={(v) => setForm({ ...form, hospital_name: v })} required />
          <div className="grid grid-cols-2 gap-2">
            <Input label={t("city")} value={form.city} onChange={(v) => setForm({ ...form, city: v })} required />
            <Input label={t("area")} value={form.area} onChange={(v) => setForm({ ...form, area: v })} />
          </div>
          <Input label={t("contact")} value={form.contact_phone} onChange={(v) => setForm({ ...form, contact_phone: v })} required />
          <Input
            label={t("neededBy")}
            type="datetime-local"
            value={form.needed_by}
            onChange={(v) => setForm({ ...form, needed_by: v })}
          />
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">{t("urgency")}</label>
            <div className="grid grid-cols-3 gap-1 mt-1">
              {(["normal", "urgent", "critical"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setForm({ ...form, urgency: u })}
                  className={`rounded-xl py-2 text-xs font-semibold border ${
                    form.urgency === u
                      ? u === "critical"
                        ? "bg-destructive text-destructive-foreground border-destructive"
                        : u === "urgent"
                        ? "bg-[color:var(--urgent)] text-white border-transparent"
                        : "bg-primary text-primary-foreground border-primary"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {t(u)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">{t("notes")}</label>
            <textarea
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full mt-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? t("saving") : t("post")}
          </button>
        </div>
      </form>
    </div>
  );
}

function Input({
  label, value, onChange, type = "text", required,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      <input
        className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  );
}
