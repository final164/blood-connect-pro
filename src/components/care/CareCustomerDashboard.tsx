import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Ambulance,
  FlaskConical,
  LayoutDashboard,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { fetchMySerials } from "@/lib/care-api";
import { fetchMyLabBookings } from "@/lib/care-lab-api";
import { fetchMyAmbulanceRequests } from "@/lib/ambulance-api";
import { formatCareMoney } from "@/lib/care-invoice";
import {
  CareLabProgressMini,
  labStatusLabel,
  labStatusTone,
  summarizeLabGroupStatus,
} from "@/components/care/CareLabProgress";
import { CareOrgChatButton } from "@/components/care/CareOrgChatButton";
import { cn } from "@/lib/utils";

function groupLabBookings(labs: Awaited<ReturnType<typeof fetchMyLabBookings>>) {
  const map = new Map<string, typeof labs>();
  for (const b of labs) {
    const key = b.invoice_group_id || b.invoice_no || b.id;
    const list = map.get(key) ?? [];
    list.push(b);
    map.set(key, list);
  }
  return [...map.entries()].map(([key, items]) => ({
    key,
    items: items.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)),
    total: items.reduce((n, b) => n + Number(b.price ?? 0), 0),
  }));
}

function serialTone(status: string, pending: boolean) {
  if (pending) return "bg-amber-500/10 text-amber-800 border-amber-500/30";
  if (status === "completed" || status === "done") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
  if (status === "cancelled" || status === "no_show")
    return "bg-destructive/10 text-destructive border-destructive/30";
  return "bg-sky-500/10 text-sky-700 border-sky-500/30";
}

function ambulanceTone(status: string) {
  if (status === "completed" || status === "delivered")
    return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
  if (status === "cancelled") return "bg-destructive/10 text-destructive border-destructive/30";
  if (status === "en_route" || status === "assigned" || status === "accepted")
    return "bg-sky-500/10 text-sky-700 border-sky-500/30";
  return "bg-amber-500/10 text-amber-800 border-amber-500/30";
}

function ambulanceLabel(status: string, lang: "bn" | "en") {
  const map: Record<string, { bn: string; en: string }> = {
    requested: { bn: "অনুরোধ", en: "Requested" },
    accepted: { bn: "গ্রহণ", en: "Accepted" },
    assigned: { bn: "অ্যাসাইনড", en: "Assigned" },
    en_route: { bn: "পথে", en: "En route" },
    arrived: { bn: "পৌঁছেছে", en: "Arrived" },
    completed: { bn: "সম্পন্ন", en: "Completed" },
    cancelled: { bn: "বাতিল", en: "Cancelled" },
  };
  const row = map[status];
  if (!row) return status;
  return lang === "bn" ? row.bn : row.en;
}

export function CareCustomerDashboard({
  lang,
  userId,
}: {
  lang: "bn" | "en";
  userId?: string;
}) {
  const [serials, setSerials] = useState<Awaited<ReturnType<typeof fetchMySerials>>>([]);
  const [labs, setLabs] = useState<Awaited<ReturnType<typeof fetchMyLabBookings>>>([]);
  const [ambulance, setAmbulance] = useState<Awaited<ReturnType<typeof fetchMyAmbulanceRequests>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void Promise.all([fetchMySerials(), fetchMyLabBookings(), fetchMyAmbulanceRequests()])
      .then(([s, l, a]) => {
        if (cancelled) return;
        setSerials(s);
        setLabs(l);
        setAmbulance(a);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const labGroups = useMemo(() => groupLabBookings(labs), [labs]);
  const activeSerials = serials.filter(
    (s) => !["cancelled", "completed", "no_show"].includes(s.status),
  ).length;
  const activeLabs = labGroups.filter((g) => {
    const st = summarizeLabGroupStatus(g.items.map((b) => b.status));
    return st !== "completed" && st !== "cancelled" && st !== "no_show";
  }).length;
  const activeAmbulance = ambulance.filter(
    (a) => !["completed", "cancelled", "delivered"].includes(a.status),
  ).length;

  if (!userId) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border bg-gradient-to-br from-primary/10 to-transparent p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-10 w-10 rounded-2xl bg-primary/15 text-primary grid place-items-center">
              <LayoutDashboard className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-bold">
                {lang === "bn" ? "কেয়ার ড্যাশবোর্ড" : "Care dashboard"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {lang === "bn"
                  ? "সিরিয়াল, টেস্ট ও অ্যাম্বুলেন্স বুকিং এক জায়গায়।"
                  : "Serials, tests and ambulance bookings in one place."}
              </p>
            </div>
          </div>
          <Link
            to="/auth"
            search={{ next: "/care?tab=dashboard" } as never}
            className="inline-flex rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold"
          >
            {lang === "bn" ? "লগইন করে দেখুন" : "Log in to view"}
          </Link>
        </div>
        <QuickLinks lang={lang} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-24 rounded-2xl border bg-muted/40 animate-pulse" />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-2xl border bg-muted/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const empty = !serials.length && !labs.length && !ambulance.length;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
        <div className="flex items-center gap-2">
          <span className="h-10 w-10 rounded-2xl bg-primary/15 text-primary grid place-items-center shrink-0">
            <LayoutDashboard className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-base font-bold">
              {lang === "bn" ? "আমার কেয়ার ড্যাশবোর্ড" : "My Care dashboard"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {lang === "bn"
                ? "সব বুকিংয়ের স্ট্যাটাস ও অগ্রগতি এখানে।"
                : "Status and progress for all your bookings."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SummaryCard
          href="#dash-serials"
          icon={Stethoscope}
          label={lang === "bn" ? "ডাক্তার সিরিয়াল" : "Doctor serial"}
          total={serials.length}
          active={activeSerials}
          accent="text-sky-700 bg-sky-500/10"
          lang={lang}
        />
        <SummaryCard
          href="#dash-tests"
          icon={FlaskConical}
          label={lang === "bn" ? "ল্যাব টেস্ট" : "Lab tests"}
          total={labGroups.length}
          active={activeLabs}
          accent="text-primary bg-primary/10"
          lang={lang}
        />
        <SummaryCard
          href="#dash-ambulance"
          icon={Ambulance}
          label={lang === "bn" ? "অ্যাম্বুলেন্স" : "Ambulance"}
          total={ambulance.length}
          active={activeAmbulance}
          accent="text-orange-700 bg-orange-500/10"
          lang={lang}
        />
      </div>

      <QuickLinks lang={lang} />

      {empty ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {lang === "bn" ? "এখনো কোনো বুকিং নেই — উপরে থেকে শুরু করুন।" : "No bookings yet — start above."}
        </p>
      ) : (
        <>
          <section id="dash-serials" className="space-y-2 scroll-mt-24">
            <SectionHead
              icon={Stethoscope}
              title={lang === "bn" ? "ডাক্তার সিরিয়াল" : "Doctor serials"}
              count={serials.length}
            />
            {serials.length === 0 ? (
              <EmptyHint
                lang={lang}
                textBn="কোনো সিরিয়াল নেই"
                textEn="No serials yet"
                to="/care"
                search={{ tab: "doctors" }}
                ctaBn="ডাক্তার খুঁজুন"
                ctaEn="Find a doctor"
              />
            ) : (
              <ul className="space-y-2">
                {serials.map((s) => {
                  const pending = s.status === "pending_approval" || s.serial_no == null;
                  const orgId = s.session?.org_id;
                  return (
                    <li
                      key={s.id}
                      className="rounded-2xl border bg-card flex items-stretch overflow-hidden"
                    >
                      <Link
                        to="/care/serial/$id"
                        params={{ id: s.id }}
                        className="min-w-0 flex-1 px-3 py-3 hover:bg-muted/40 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold min-w-0">
                            {pending
                              ? lang === "bn"
                                ? `অনলাইন #${s.online_serial_no ?? "—"}`
                                : `Online #${s.online_serial_no ?? "—"}`
                              : lang === "bn"
                                ? `সিরিয়াল #${s.serial_no}`
                                : `Serial #${s.serial_no}`}
                          </p>
                          <span
                            className={cn(
                              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                              serialTone(s.status, pending),
                            )}
                          >
                            {pending
                              ? lang === "bn"
                                ? "অনুমোদন বাকি"
                                : "Pending"
                              : s.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {s.session?.session_date}
                          {s.claim_code ? ` · ${s.claim_code}` : ""}
                          {s.fee_amount != null ? ` · ৳${s.fee_amount}` : ""}
                        </p>
                      </Link>
                      {orgId ? (
                        <div className="shrink-0 flex items-center pr-2">
                          <CareOrgChatButton orgId={orgId} variant="icon" />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section id="dash-tests" className="space-y-2 scroll-mt-24">
            <SectionHead
              icon={FlaskConical}
              title={lang === "bn" ? "ল্যাব টেস্ট" : "Lab tests"}
              count={labGroups.length}
            />
            {labGroups.length === 0 ? (
              <EmptyHint
                lang={lang}
                textBn="কোনো টেস্ট বুকিং নেই"
                textEn="No lab bookings yet"
                to="/care"
                search={{ tab: "tests" }}
                ctaBn="টেস্ট বুক করুন"
                ctaEn="Book a test"
              />
            ) : (
              <ul className="space-y-2">
                {labGroups.map((g) => {
                  const primary = g.items[0];
                  const groupStatus = summarizeLabGroupStatus(g.items.map((b) => b.status));
                  const title =
                    g.items.length > 1
                      ? lang === "bn"
                        ? `${g.items.length}টি টেস্ট`
                        : `${g.items.length} tests`
                      : lang === "bn"
                        ? primary.offering?.name_bn || primary.offering?.name_en || "টেস্ট"
                        : primary.offering?.name_en || primary.offering?.name_bn || "Test";
                  return (
                    <li
                      key={g.key}
                      className="rounded-2xl border bg-card flex items-stretch overflow-hidden"
                    >
                      <Link
                        to="/care/lab-booking/$id"
                        params={{ id: primary.id }}
                        className="min-w-0 flex-1 px-3 py-3 hover:bg-muted/40 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold min-w-0 truncate">{title}</p>
                          <span className="text-[11px] font-bold tabular-nums text-primary shrink-0">
                            {formatCareMoney(g.total, lang)}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {g.items.length > 1
                            ? primary.invoice_no || primary.reference_code
                            : primary.reference_code}
                        </p>
                        <CareLabProgressMini status={groupStatus} lang={lang} />
                        {g.items.length > 1 && (
                          <ul className="space-y-1.5 pt-0.5 border-t border-dashed">
                            {g.items.map((b) => (
                              <li
                                key={b.id}
                                className="flex items-center justify-between gap-2 text-[11px]"
                              >
                                <span className="truncate text-muted-foreground">
                                  {(lang === "bn" ? b.offering?.name_bn : b.offering?.name_en) ||
                                    b.reference_code}
                                </span>
                                <span
                                  className={cn(
                                    "shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold",
                                    labStatusTone(b.status),
                                  )}
                                >
                                  {labStatusLabel(b.status, lang)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </Link>
                      {primary.org_id ? (
                        <div className="shrink-0 flex items-start pt-2.5 pr-2">
                          <CareOrgChatButton orgId={primary.org_id} variant="icon" />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section id="dash-ambulance" className="space-y-2 scroll-mt-24">
            <SectionHead
              icon={Ambulance}
              title={lang === "bn" ? "অ্যাম্বুলেন্স" : "Ambulance"}
              count={ambulance.length}
            />
            {ambulance.length === 0 ? (
              <EmptyHint
                lang={lang}
                textBn="কোনো অ্যাম্বুলেন্স বুকিং নেই"
                textEn="No ambulance bookings yet"
                to="/ambulance"
                ctaBn="অ্যাম্বুলেন্স বুক"
                ctaEn="Book ambulance"
              />
            ) : (
              <ul className="space-y-2">
                {ambulance.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-2xl border bg-card flex items-stretch overflow-hidden"
                  >
                    <Link
                      to="/ambulance/request/$id"
                      params={{ id: b.id }}
                      className="min-w-0 flex-1 px-3 py-3 hover:bg-muted/40 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold truncate">{b.reference_code}</p>
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                            ambulanceTone(b.status),
                          )}
                        >
                          {ambulanceLabel(b.status, lang)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {b.mode}
                        {b.invoice_no ? ` · ${b.invoice_no}` : ""}
                        {b.estimated_fare != null ? ` · ৳${b.estimated_fare}` : ""}
                      </p>
                    </Link>
                    {b.org_id ? (
                      <div className="shrink-0 flex items-center pr-2">
                        <CareOrgChatButton orgId={b.org_id} variant="icon" />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  href,
  icon: Icon,
  label,
  total,
  active,
  accent,
  lang,
}: {
  href: string;
  icon: typeof Stethoscope;
  label: string;
  total: number;
  active: number;
  accent: string;
  lang: "bn" | "en";
}) {
  return (
    <a
      href={href}
      className="rounded-2xl border bg-card p-3 hover:border-primary/30 transition text-left block"
    >
      <span className={cn("h-8 w-8 rounded-xl grid place-items-center mb-2", accent)}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground leading-tight">
        {label}
      </p>
      <p className="text-xl font-black tabular-nums mt-0.5">{total}</p>
      <p className="text-[10px] text-muted-foreground">
        {lang === "bn" ? `${active}টি চলমান` : `${active} active`}
      </p>
    </a>
  );
}

function SectionHead({
  icon: Icon,
  title,
  count,
}: {
  icon: typeof Stethoscope;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 px-0.5">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex-1">
        {title}
      </h2>
      <span className="text-[10px] font-bold tabular-nums text-muted-foreground">{count}</span>
    </div>
  );
}

function QuickLinks({ lang }: { lang: "bn" | "en" }) {
  const links = [
    {
      to: "/care" as const,
      search: { tab: "doctors" },
      icon: Stethoscope,
      label: lang === "bn" ? "ডাক্তার" : "Doctors",
    },
    {
      to: "/care" as const,
      search: { tab: "tests" },
      icon: FlaskConical,
      label: lang === "bn" ? "টেস্ট" : "Tests",
    },
    {
      to: "/ambulance" as const,
      search: undefined,
      icon: Ambulance,
      label: lang === "bn" ? "অ্যাম্বুলেন্স" : "Ambulance",
    },
    {
      to: "/care/ai-tests" as const,
      search: undefined,
      icon: Sparkles,
      label: lang === "bn" ? "AI সাজেশন" : "AI",
    },
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {links.map((l) => (
        <Link
          key={l.label}
          to={l.to}
          search={l.search as never}
          className="rounded-xl border bg-card px-2 py-2.5 text-center hover:bg-muted/40"
        >
          <l.icon className="h-4 w-4 mx-auto text-primary" />
          <p className="text-[10px] font-semibold mt-1 truncate">{l.label}</p>
        </Link>
      ))}
    </div>
  );
}

function EmptyHint({
  lang,
  textBn,
  textEn,
  to,
  search,
  ctaBn,
  ctaEn,
}: {
  lang: "bn" | "en";
  textBn: string;
  textEn: string;
  to: string;
  search?: Record<string, string>;
  ctaBn: string;
  ctaEn: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed bg-muted/20 px-3 py-6 text-center space-y-2">
      <p className="text-xs text-muted-foreground">{lang === "bn" ? textBn : textEn}</p>
      <Link
        to={to}
        search={search as never}
        className="inline-flex text-xs font-bold text-primary"
      >
        {lang === "bn" ? ctaBn : ctaEn} →
      </Link>
    </div>
  );
}
