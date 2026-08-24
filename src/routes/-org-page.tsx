import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Phone,
  Settings2,
  Shield,
  UserPlus,
  Users,
} from "lucide-react";
import { OrgContactSettingsForm } from "@/components/org/OrgContactSettingsForm";
import { OrgDonorsManager } from "@/components/org/OrgDonorsManager";
import { OrgMembersAdmin } from "@/components/org/OrgMembersAdmin";
import { OrgOutboundContact } from "@/components/org/OrgOutboundContact";
import { OrgRequestsInbox } from "@/components/org/OrgRequestsInbox";
import { OrgRolesManager } from "@/components/org/OrgRolesManager";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useAuth } from "@/lib/auth-context";
import { fetchAllDistricts, type District } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  countOrgDonors,
  countOrgOpenRequests,
  fetchMyOrgMemberships,
  membershipHasPermission,
  type OrgMembership,
} from "@/lib/org-access";
import type { OrgPermissionKey } from "@/lib/org-permissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type OrgTab =
  | "overview"
  | "donors"
  | "settings"
  | "requests"
  | "contact"
  | "members"
  | "roles";

export function OrgPortalPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { lang } = useI18n();
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [tab, setTab] = useState<OrgTab>("overview");
  const [ready, setReady] = useState(false);
  const [districts, setDistricts] = useState<District[]>([]);
  const [donorCount, setDonorCount] = useState(0);
  const [openReqCount, setOpenReqCount] = useState(0);
  const [orgMeta, setOrgMeta] = useState<OrgMembership["community_orgs"]>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/auth", search: {} });
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchMyOrgMemberships();
        if (cancelled) return;
        const active = rows.filter((r) => r.community_orgs?.is_active !== false);
        if (active.length === 0) {
          toast.error(lang === "bn" ? "কোনো অর্গানাইজেশন মেম্বারশিপ নেই" : "No organization membership");
          void navigate({ to: "/home" });
          return;
        }
        setMemberships(active);
        setOrgId((prev) => prev ?? active[0]!.org_id);
        setReady(true);
      } catch (e) {
        if (!cancelled) {
          toast.error((e as Error).message);
          void navigate({ to: "/home" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user, navigate, lang]);

  useEffect(() => {
    void fetchAllDistricts().then(setDistricts).catch(() => setDistricts([]));
  }, []);

  const membership = useMemo(
    () => memberships.find((m) => m.org_id === orgId) ?? null,
    [memberships, orgId],
  );

  const can = (key: OrgPermissionKey) => membershipHasPermission(membership, key);

  const org = membership?.community_orgs ?? orgMeta;
  const orgName =
    lang === "bn" ? org?.name_bn || org?.name || "Organization" : org?.name || "Organization";
  const roleLabel = membership?.community_org_roles
    ? lang === "bn"
      ? membership.community_org_roles.name_bn || membership.community_org_roles.name
      : membership.community_org_roles.name
    : membership?.role;

  useEffect(() => {
    if (!orgId) return;
    const m = memberships.find((x) => x.org_id === orgId);
    setOrgMeta(m?.community_orgs ?? null);
    void countOrgDonors(orgId).then(setDonorCount);
    void countOrgOpenRequests(orgId).then(setOpenReqCount);
  }, [orgId, memberships, tab]);

  const tabs = useMemo(() => {
    const all: { id: OrgTab; label: string; icon: typeof LayoutDashboard; show: boolean }[] = [
      { id: "overview", label: lang === "bn" ? "ওভারভিউ" : "Overview", icon: LayoutDashboard, show: true },
      { id: "donors", label: lang === "bn" ? "রক্তদাতা" : "Donors", icon: Users, show: can("donors.view") },
      {
        id: "settings",
        label: lang === "bn" ? "কন্টাক্ট সেটিংস" : "Contact settings",
        icon: Settings2,
        show: can("settings.view"),
      },
      {
        id: "requests",
        label: lang === "bn" ? "রিকোয়েস্ট" : "Requests",
        icon: HeartPulse,
        show: can("requests.view"),
      },
      {
        id: "contact",
        label: lang === "bn" ? "কন্টাক্ট / SMS" : "Contact / SMS",
        icon: MessageSquare,
        show: can("contact.send"),
      },
      {
        id: "members",
        label: lang === "bn" ? "মেম্বার" : "Members",
        icon: UserPlus,
        show: can("members.view"),
      },
      { id: "roles", label: lang === "bn" ? "রোল" : "Roles", icon: Shield, show: can("roles.manage") },
    ];
    return all.filter((t) => t.show);
    // membership drives can()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, membership]);

  useEffect(() => {
    if (!ready) return;
    if (!tabs.some((t) => t.id === tab)) setTab("overview");
  }, [ready, tab, tabs]);

  async function refreshOrgMeta() {
    if (!orgId) return;
    const { data } = await supabase
      .from("community_orgs")
      .select(
        "id, name, name_bn, phone, email, website, description, description_bn, is_active, donor_contact_settings",
      )
      .eq("id", orgId)
      .maybeSingle();
    if (data) setOrgMeta(data);
    setMemberships((prev) =>
      prev.map((m) => (m.org_id === orgId ? { ...m, community_orgs: data ?? m.community_orgs } : m)),
    );
  }

  if (loading || !user || !ready || !orgId || !membership) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background text-foreground">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs text-muted-foreground">{lang === "bn" ? "লোড হচ্ছে…" : "Loading…"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-linear-to-b from-rose-50/80 via-background to-background dark:from-rose-950/20">
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <PageBackButton fallbackTo="/home" shape="xl" />
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {lang === "bn" ? "অর্গানাইজেশন প্যানেল" : "Organization panel"}
            </p>
            <h1 className="truncate text-base font-bold">{orgName}</h1>
          </div>
          {memberships.length > 1 && (
            <select
              className="max-w-40 rounded-xl border bg-background px-2 py-2 text-xs"
              value={orgId}
              onChange={(e) => {
                setOrgId(e.target.value);
                setTab("overview");
              }}
            >
              {memberships.map((m) => (
                <option key={m.org_id} value={m.org_id}>
                  {lang === "bn"
                    ? m.community_orgs?.name_bn || m.community_orgs?.name || m.org_id
                    : m.community_orgs?.name || m.org_id}
                </option>
              ))}
            </select>
          )}
          <Link
            to="/home"
            className="rounded-xl border px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            {lang === "bn" ? "অ্যাপ" : "App"}
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="grid h-9 w-9 place-items-center rounded-xl border text-muted-foreground hover:bg-muted"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2 no-scrollbar">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4 pb-16">
        {tab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={Users} label={lang === "bn" ? "রক্তদাতা" : "Donors"} value={String(donorCount)} />
              <StatCard
                icon={HeartPulse}
                label={lang === "bn" ? "ওপেন রিকোয়েস্ট" : "Open requests"}
                value={String(openReqCount)}
              />
            </div>
            <div className="rounded-2xl border bg-card p-4 space-y-2">
              <h2 className="text-sm font-semibold">{lang === "bn" ? "সংস্থার তথ্য" : "Organization info"}</h2>
              {org?.phone && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  {org.phone}
                </p>
              )}
              {(lang === "bn" ? org?.description_bn || org?.description : org?.description) && (
                <p className="text-sm text-muted-foreground">
                  {lang === "bn" ? org?.description_bn || org?.description : org?.description}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                {lang === "bn" ? "আপনার রোল" : "Your role"}:{" "}
                <span className="font-semibold text-foreground">{roleLabel}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {can("requests.view") && (
                <button
                  type="button"
                  onClick={() => setTab("requests")}
                  className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground"
                >
                  {lang === "bn" ? "রিকোয়েস্ট দেখুন" : "View requests"}
                </button>
              )}
              {can("contact.send") && (
                <button
                  type="button"
                  onClick={() => setTab("contact")}
                  className="rounded-xl border px-4 py-2.5 text-xs font-semibold"
                >
                  {lang === "bn" ? "কন্টাক্ট / SMS" : "Contact / SMS"}
                </button>
              )}
              {can("roles.manage") && (
                <button
                  type="button"
                  onClick={() => setTab("roles")}
                  className="rounded-xl border px-4 py-2.5 text-xs font-semibold"
                >
                  {lang === "bn" ? "রোল ম্যানেজ" : "Manage roles"}
                </button>
              )}
            </div>
          </div>
        )}

        {tab === "donors" && can("donors.view") && (
          <OrgDonorsManager
            orgId={orgId}
            districts={districts}
            lang={lang}
            canEdit={can("donors.edit") || can("donors.add")}
            canDelete={can("donors.delete")}
            canImport={can("donors.import")}
          />
        )}

        {tab === "settings" && can("settings.view") && (
          <OrgContactSettingsForm
            orgId={orgId}
            initial={org?.donor_contact_settings}
            lang={lang}
            canEdit={can("settings.edit")}
            onSaved={() => void refreshOrgMeta()}
          />
        )}

        {tab === "requests" && can("requests.view") && (
          <OrgRequestsInbox orgId={orgId} lang={lang} canEdit={can("requests.edit")} />
        )}

        {tab === "contact" && can("contact.send") && (
          <OrgOutboundContact orgId={orgId} lang={lang} canEdit={can("contact.send")} />
        )}

        {tab === "members" && can("members.view") && (
          <div className="rounded-xl border bg-card p-3">
            <OrgMembersAdmin orgId={orgId} lang={lang} canEdit={can("members.manage")} variant="app" />
          </div>
        )}

        {tab === "roles" && <OrgRolesManager orgId={orgId} lang={lang} canManage={can("roles.manage")} />}
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
