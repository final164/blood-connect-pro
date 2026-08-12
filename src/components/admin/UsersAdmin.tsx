import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllDistrictsAdmin, type District } from "@/lib/api";
import { fetchUpazilaOptions } from "@/lib/upazilas";
import { BLOOD_GROUPS } from "@/lib/format";
import { adminDeleteUser } from "@/lib/admin-delete-user";
import { adminFetchUserPin } from "@/lib/admin-fetch-user-pin";
import {
  districtAllowed,
  isAllDistricts,
  isAllUpazilas,
  parseUpazilaScopeKey,
  upazilaAllowed,
} from "@/lib/users-geo-scope";
import { Ban, Eye, EyeOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  blood_group: string | null;
  city: string | null;
  area: string | null;
  district_id: string | null;
  is_blocked: boolean;
  show_in_community: boolean;
  created_at: string;
};

type UserStats = {
  posts: number;
  received: number;
  donated: number;
};

const ALL = "all";
const YES = "yes";
const NO = "no";

const sel =
  "rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-rose-500/40";

export function UsersAdmin() {
  const { t, lang } = useI18n();
  const { can, isSuper, usersGeoScope } = useAdminAccess();
  const canViewPin = isSuper || can("users.view_pin") || can("users.view");

  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<Record<string, string[]>>({});
  const [creds, setCreds] = useState<Record<string, { phone: string | null; pin: string }>>({});
  const [stats, setStats] = useState<Record<string, UserStats>>({});
  const [districts, setDistricts] = useState<District[]>([]);
  const [districtMap, setDistrictMap] = useState<Record<string, District>>({});
  const [upazilaOptions, setUpazilaOptions] = useState<string[]>([]);
  const [revealPin, setRevealPin] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const [searchPhone, setSearchPhone] = useState("");
  const [filterRole, setFilterRole] = useState<string>("user");
  const [filterDistrict, setFilterDistrict] = useState<string>(ALL);
  const [filterUpazila, setFilterUpazila] = useState<string>(ALL);
  const [filterBlood, setFilterBlood] = useState<string>(ALL);
  const [filterDonated, setFilterDonated] = useState<string>(ALL);
  const [filterReceived, setFilterReceived] = useState<string>(ALL);

  async function load() {
    setLoading(true);
    try {
      let profiles: ProfileRow[] | null = null;
      const withFlag = await supabase
        .from("profiles")
        .select(
          "id, full_name, phone, blood_group, city, area, district_id, is_blocked, show_in_community, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(1000);
      if (withFlag.error && /show_in_community|column/i.test(withFlag.error.message)) {
        const fallback = await supabase
          .from("profiles")
          .select("id, full_name, phone, blood_group, city, area, district_id, is_blocked, created_at")
          .order("created_at", { ascending: false })
          .limit(1000);
        if (fallback.error) throw fallback.error;
        profiles = ((fallback.data ?? []) as Omit<ProfileRow, "show_in_community">[]).map((p) => ({
          ...p,
          show_in_community: true,
        }));
      } else {
        if (withFlag.error) throw withFlag.error;
        profiles = ((withFlag.data ?? []) as ProfileRow[]).map((p) => ({
          ...p,
          show_in_community: p.show_in_community !== false,
        }));
      }

      const [{ data: roleRows }, credsRes, { data: requests }, { data: offers }, ds] =
        await Promise.all([
          supabase.from("user_roles").select("user_id, role"),
          supabase.from("user_login_credentials").select("user_id, phone, pin"),
          supabase.from("blood_requests").select("requester_id, status"),
          supabase.from("request_donation_offers").select("donor_id, status").eq("status", "confirmed"),
          fetchAllDistrictsAdmin(),
        ]);

      if (credsRes.error) {
        console.warn("user_login_credentials:", credsRes.error.message);
      }
      const loginCreds = credsRes.data;

      setRows(profiles ?? []);
      setDistricts(ds);
      const dMap: Record<string, District> = {};
      for (const d of ds) dMap[d.id] = d;
      setDistrictMap(dMap);

      const rMap: Record<string, string[]> = {};
      for (const r of roleRows ?? []) {
        rMap[r.user_id] = [...(rMap[r.user_id] ?? []), r.role];
      }
      setRoles(rMap);

      const cMap: Record<string, { phone: string | null; pin: string }> = {};
      for (const c of loginCreds ?? []) {
        cMap[c.user_id] = { phone: c.phone, pin: c.pin };
      }
      setCreds(cMap);

      const sMap: Record<string, UserStats> = {};
      for (const req of requests ?? []) {
        const id = req.requester_id as string;
        if (!sMap[id]) sMap[id] = { posts: 0, received: 0, donated: 0 };
        sMap[id].posts += 1;
        if (req.status === "fulfilled") sMap[id].received += 1;
      }
      for (const o of offers ?? []) {
        const id = o.donor_id as string;
        if (!sMap[id]) sMap[id] = { posts: 0, received: 0, donated: 0 };
        sMap[id].donated += 1;
      }
      setStats(sMap);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const scopedDistricts = useMemo(() => {
    if (isAllDistricts(usersGeoScope)) return districts;
    return districts.filter((d) => usersGeoScope.districts.includes(d.id));
  }, [districts, usersGeoScope]);

  useEffect(() => {
    if (filterDistrict === ALL) return;
    if (!scopedDistricts.some((d) => d.id === filterDistrict)) {
      setFilterDistrict(ALL);
      setFilterUpazila(ALL);
    }
  }, [scopedDistricts, filterDistrict]);

  // Load upazila catalog for filter dropdown (not only from user profiles)
  useEffect(() => {
    let cancelled = false;

    async function loadUpazilas() {
      const targetDistricts =
        filterDistrict !== ALL
          ? scopedDistricts.filter((d) => d.id === filterDistrict)
          : scopedDistricts;

      if (!targetDistricts.length) {
        if (!cancelled) setUpazilaOptions([]);
        return;
      }

      const list = targetDistricts.slice(0, filterDistrict === ALL ? 64 : 1);
      const names = new Set<string>();

      if (!isAllUpazilas(usersGeoScope)) {
        for (const key of usersGeoScope.upazilas) {
          const parsed = parseUpazilaScopeKey(key);
          if (!parsed) continue;
          if (filterDistrict !== ALL && parsed.districtId !== filterDistrict) continue;
          if (!isAllDistricts(usersGeoScope) && !usersGeoScope.districts.includes(parsed.districtId)) {
            continue;
          }
          names.add(parsed.name);
        }
      } else {
        await Promise.all(
          list.map(async (d) => {
            try {
              const opts = await fetchUpazilaOptions(d);
              for (const o of opts) {
                const label = o.bn || o.en;
                if (label && upazilaAllowed(usersGeoScope, d.id, label)) names.add(label);
              }
            } catch {
              /* ignore one district failure */
            }
          }),
        );
      }

      if (!cancelled) {
        setUpazilaOptions([...names].sort((a, b) => a.localeCompare(b, "bn")));
      }
    }

    void loadUpazilas();
    return () => {
      cancelled = true;
    };
  }, [filterDistrict, scopedDistricts, usersGeoScope]);

  const upazilaChoices = upazilaOptions;

  const phoneSearchActive = can("users.filter_search") && searchPhone.replace(/\D/g, "").length >= 3;

  const filtered = useMemo(() => {
    const q = searchPhone.replace(/\D/g, "");

    return rows.filter((u) => {
      const phone = (creds[u.id]?.phone || u.phone || "").replace(/\D/g, "");
      const isAdmin = (roles[u.id] ?? []).includes("admin");
      const st = stats[u.id] ?? { posts: 0, received: 0, donated: 0 };
      const district = u.district_id ? districtMap[u.district_id] : null;
      const upazila = u.area ?? "";

      if (phoneSearchActive && q) {
        return phone.includes(q);
      }

      // Geo scope from access control (unless phone search)
      if (!isAllDistricts(usersGeoScope) || !isAllUpazilas(usersGeoScope)) {
        if (!districtAllowed(usersGeoScope, u.district_id)) return false;
        if (
          !isAllUpazilas(usersGeoScope) &&
          u.area &&
          !upazilaAllowed(usersGeoScope, u.district_id, u.area)
        ) {
          return false;
        }
        // Scoped upazilas but user has no area — still allow if district ok and upazila filter not specific
      }

      if (can("users.filter_role") && filterRole !== ALL) {
        if (filterRole === "admin" && !isAdmin) return false;
        if (filterRole === "user" && isAdmin) return false;
      }

      if (can("users.filter_district") && filterDistrict !== ALL) {
        if (u.district_id !== filterDistrict) return false;
      }

      if (can("users.filter_upazila") && filterUpazila !== ALL) {
        if ((upazila || "").toLowerCase() !== filterUpazila.toLowerCase()) return false;
      }

      if (can("users.filter_blood_group") && filterBlood !== ALL) {
        if ((u.blood_group ?? "") !== filterBlood) return false;
      }

      if (can("users.filter_donated") && filterDonated !== ALL) {
        const has = st.donated > 0;
        if (filterDonated === YES && !has) return false;
        if (filterDonated === NO && has) return false;
      }

      if (can("users.filter_received") && filterReceived !== ALL) {
        const has = st.received > 0;
        if (filterReceived === YES && !has) return false;
        if (filterReceived === NO && has) return false;
      }

      return true;
    });
  }, [
    rows,
    creds,
    roles,
    stats,
    districtMap,
    searchPhone,
    phoneSearchActive,
    filterRole,
    filterDistrict,
    filterUpazila,
    filterBlood,
    filterDonated,
    filterReceived,
    lang,
    can,
    usersGeoScope,
  ]);

  async function togglePinReveal(userId: string) {
    if (!canViewPin) return;

    // Hide if already revealed
    if (revealPin[userId] && creds[userId]?.pin) {
      setRevealPin((prev) => ({ ...prev, [userId]: false }));
      return;
    }

    let pin = creds[userId]?.pin;
    if (!pin) {
      // 1) Security-definer RPC
      const { data: rpcData, error: rpcErr } = await supabase.rpc("admin_get_user_pin", {
        p_user_id: userId,
      });

      if (!rpcErr && rpcData) {
        const row = rpcData as { pin?: string | null; phone?: string | null };
        if (row.pin) {
          setCreds((prev) => ({
            ...prev,
            [userId]: { phone: row.phone ?? prev[userId]?.phone ?? null, pin: row.pin! },
          }));
          pin = row.pin;
        }
      }

      // 2) Direct table
      if (!pin) {
        const { data } = await supabase
          .from("user_login_credentials")
          .select("user_id, phone, pin")
          .eq("user_id", userId)
          .maybeSingle();
        if (data?.pin) {
          setCreds((prev) => ({
            ...prev,
            [userId]: { phone: data.phone, pin: data.pin },
          }));
          pin = data.pin;
        }
      }

      // 3) Service-role server fn (bypasses all client RLS)
      if (!pin) {
        try {
          const res = await adminFetchUserPin({ data: { userId } });
          if (res.ok && res.pin) {
            setCreds((prev) => ({
              ...prev,
              [userId]: { phone: res.phone, pin: res.pin },
            }));
            pin = res.pin;
          }
        } catch (err) {
          const msg = (err as Error).message || "";
          if (/SERVICE_ROLE|not configured/i.test(msg)) {
            toast.error(
              lang === "bn"
                ? "PIN দেখতে .env-এ SUPABASE_SERVICE_ROLE_KEY সেট করুন এবং scripts/admin-creds-view-pin.sql চালান"
                : "Set SUPABASE_SERVICE_ROLE_KEY and run scripts/admin-creds-view-pin.sql",
            );
            return;
          }
        }
      }
    }

    if (!pin) {
      toast.error(
        lang === "bn"
          ? "এই ইউজারের PIN খুঁজে পাওয়া যায়নি"
          : "Could not find PIN for this user",
      );
      return;
    }

    setRevealPin((prev) => ({ ...prev, [userId]: true }));
  }

  async function toggleBlock(userId: string, blocked: boolean) {
    if (!can("users.block")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    const { error } = await supabase.from("profiles").update({ is_blocked: blocked }).eq("id", userId);
    if (error) return toast.error(error.message);
    toast.success(t("saved"));
    void load();
  }

  async function toggleCommunity(userId: string, show: boolean) {
    if (!can("users.edit")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    const { error } = await supabase
      .from("profiles")
      .update({ show_in_community: show })
      .eq("id", userId);
    if (error) return toast.error(error.message);
    setRows((prev) =>
      prev.map((r) => (r.id === userId ? { ...r, show_in_community: show } : r)),
    );
    toast.success(
      show
        ? lang === "bn"
          ? "কমিউনিটিতে দেখাবে"
          : "Visible in Community"
        : lang === "bn"
          ? "কমিউনিটি থেকে লুকানো"
          : "Hidden from Community",
    );
  }

  async function removeUser(userId: string, name: string) {
    if (!can("users.delete")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    const msg =
      lang === "bn"
        ? `${name || "ইউজার"} মুছে ফেলবেন? এটি ফিরিয়ে আনা যাবে না।`
        : `Delete ${name || "user"}? This cannot be undone.`;
    if (!confirm(msg)) return;
    try {
      await adminDeleteUser({ data: { userId } });
      toast.success(lang === "bn" ? "ইউজার ডিলিট হয়েছে" : "User deleted");
      void load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {can("users.filter_search") && (
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">
                {lang === "bn" ? "ফোন সার্চ" : "Search phone"}
              </label>
              <input
                className={sel + " w-full font-mono"}
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                inputMode="numeric"
              />
            </div>
          )}
          {can("users.filter_role") && (
            <FilterSelect
              label={lang === "bn" ? "রোল" : "Role"}
              value={filterRole}
              onChange={setFilterRole}
              options={[
                { v: ALL, l: lang === "bn" ? "সব" : "All" },
                { v: "user", l: lang === "bn" ? "ইউজার" : "User" },
                { v: "admin", l: lang === "bn" ? "অ্যাডমিন" : "Admin" },
              ]}
            />
          )}
          {can("users.filter_district") && (
            <FilterSelect
              label={lang === "bn" ? "জেলা" : "District"}
              value={filterDistrict}
              onChange={(v) => {
                setFilterDistrict(v);
                setFilterUpazila(ALL);
              }}
              options={[
                { v: ALL, l: lang === "bn" ? "সব" : "All" },
                ...scopedDistricts.map((d) => ({
                  v: d.id,
                  l: lang === "bn" ? d.name_bn : d.name_en,
                })),
              ]}
            />
          )}
          {can("users.filter_upazila") && (
            <FilterSelect
              label={lang === "bn" ? "উপজেলা" : "Upazila"}
              value={filterUpazila}
              onChange={setFilterUpazila}
              options={[
                { v: ALL, l: lang === "bn" ? "সব" : "All" },
                ...upazilaChoices.map((u) => ({ v: u, l: u })),
              ]}
            />
          )}
          {can("users.filter_blood_group") && (
            <FilterSelect
              label={lang === "bn" ? "রক্তের গ্রুপ" : "Blood group"}
              value={filterBlood}
              onChange={setFilterBlood}
              options={[
                { v: ALL, l: lang === "bn" ? "সব" : "All" },
                ...BLOOD_GROUPS.map((g) => ({ v: g, l: g })),
              ]}
            />
          )}
          {can("users.filter_donated") && (
            <FilterSelect
              label={lang === "bn" ? "দান করেছে" : "Donated"}
              value={filterDonated}
              onChange={setFilterDonated}
              options={[
                { v: ALL, l: lang === "bn" ? "সব" : "All" },
                { v: YES, l: lang === "bn" ? "হ্যাঁ" : "Yes" },
                { v: NO, l: lang === "bn" ? "না" : "No" },
              ]}
            />
          )}
          {can("users.filter_received") && (
            <FilterSelect
              label={lang === "bn" ? "গ্রহণ (complete)" : "Received"}
              value={filterReceived}
              onChange={setFilterReceived}
              options={[
                { v: ALL, l: lang === "bn" ? "সব" : "All" },
                { v: YES, l: lang === "bn" ? "হ্যাঁ" : "Yes" },
                { v: NO, l: lang === "bn" ? "না" : "No" },
              ]}
            />
          )}
        </div>
        {phoneSearchActive && (
          <p className="text-[10px] text-amber-400/90 px-1">
            {lang === "bn"
              ? "ফোন সার্চ সক্রিয় — মিলে যাওয়া ইউজারের জেলা/উপজেলাসহ সব তথ্য দেখানো হচ্ছে"
              : "Phone search active — showing full details for matches"}
          </p>
        )}
        <p className="text-[10px] text-slate-500 px-1">
          {loading ? t("loading") : `${filtered.length} / ${rows.length}`}
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 admin-table-scroll">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-slate-800/60 text-xs text-slate-400">
            <tr>
              <th className="text-left p-3">{lang === "bn" ? "নাম" : "Name"}</th>
              <th className="text-left p-3">{lang === "bn" ? "জেলা" : "District"}</th>
              <th className="text-left p-3">{lang === "bn" ? "উপজেলা" : "Upazila"}</th>
              <th className="text-left p-3">Blood</th>
              <th className="text-left p-3">Role</th>
              <th className="text-center p-3">{lang === "bn" ? "পোস্ট" : "Posts"}</th>
              <th className="text-center p-3">{lang === "bn" ? "গ্রহণ" : "Received"}</th>
              <th className="text-center p-3">{lang === "bn" ? "দান" : "Donated"}</th>
              <th className="text-center p-3">{lang === "bn" ? "কমিউনিটি" : "Community"}</th>
              <th className="p-3 text-right">{lang === "bn" ? "অ্যাকশন" : "Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const cred = creds[u.id];
              const phone = cred?.phone || u.phone || "—";
              const pin = cred?.pin;
              const shown = revealPin[u.id];
              const isAdmin = (roles[u.id] ?? []).includes("admin");
              const st = stats[u.id] ?? { posts: 0, received: 0, donated: 0 };
              const district = u.district_id ? districtMap[u.district_id] : null;
              const districtLabel = district
                ? lang === "bn"
                  ? district.name_bn
                  : district.name_en
                : u.city || "—";

              return (
                <tr
                  key={u.id}
                  className={`border-t border-slate-800 ${u.is_blocked ? "bg-rose-950/20" : ""}`}
                >
                  <td className="p-3">
                    <p className="font-medium">{u.full_name ?? "—"}</p>
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5">{phone}</p>
                    {canViewPin ? (
                      <button
                        type="button"
                        onClick={() => void togglePinReveal(u.id)}
                        className="inline-flex items-center gap-1 text-[10px] font-mono text-rose-300/90 hover:text-rose-200 mt-0.5"
                      >
                        {shown && pin ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        PIN: {shown && pin ? pin : "••••"}
                      </button>
                    ) : (
                      <p className="text-[10px] text-slate-600 mt-0.5">PIN: —</p>
                    )}
                    {u.is_blocked && (
                      <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-rose-600/30 text-rose-200">
                        {lang === "bn" ? "ব্লক" : "Blocked"}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-slate-300">{districtLabel}</td>
                  <td className="p-3 text-xs text-slate-300">{u.area || "—"}</td>
                  <td className="p-3">{u.blood_group ?? "—"}</td>
                  <td className="p-3">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        isAdmin ? "bg-amber-500/20 text-amber-200" : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {isAdmin ? "Admin" : "User"}
                    </span>
                  </td>
                  <td className="p-3 text-center font-mono text-xs">{st.posts}</td>
                  <td className="p-3 text-center font-mono text-xs">{st.received}</td>
                  <td className="p-3 text-center font-mono text-xs">{st.donated}</td>
                  <td className="p-3 text-center">
                    {can("users.edit") ? (
                      <button
                        type="button"
                        onClick={() => void toggleCommunity(u.id, !u.show_in_community)}
                        className={`text-[10px] px-2 py-1 rounded-md ${
                          u.show_in_community
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-slate-800 text-slate-400"
                        }`}
                        title={
                          lang === "bn" ? "কমিউনিটিতে দেখাবে/লুকাবে" : "Show/hide in Community"
                        }
                      >
                        {u.show_in_community
                          ? lang === "bn"
                            ? "দেখাবে"
                            : "Shown"
                          : lang === "bn"
                            ? "লুকানো"
                            : "Hidden"}
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-500">
                        {u.show_in_community
                          ? lang === "bn"
                            ? "দেখাবে"
                            : "Shown"
                          : lang === "bn"
                            ? "লুকানো"
                            : "Hidden"}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap space-x-1">
                    {can("users.block") && (
                      <button
                        type="button"
                        onClick={() => void toggleBlock(u.id, !u.is_blocked)}
                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md ${
                          u.is_blocked
                            ? "bg-slate-700 text-slate-200"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                        title={lang === "bn" ? "ব্লক" : "Block"}
                      >
                        <Ban className="h-3 w-3" />
                        {u.is_blocked
                          ? lang === "bn"
                            ? "আনব্লক"
                            : "Unblock"
                          : lang === "bn"
                            ? "ব্লক"
                            : "Block"}
                      </button>
                    )}
                    {can("users.delete") && (
                      <button
                        type="button"
                        onClick={() => void removeUser(u.id, u.full_name ?? "")}
                        className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-rose-600/20 text-rose-300"
                        title={lang === "bn" ? "ডিলিট" : "Delete"}
                      >
                        <Trash2 className="h-3 w-3" />
                        {lang === "bn" ? "ডিলিট" : "Delete"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-500 text-sm">
                  {lang === "bn" ? "কোনো ইউজার নেই" : "No users found"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div>
      <label className="text-[10px] text-slate-500 block mb-1">{label}</label>
      <select className={sel + " w-full"} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </div>
  );
}
