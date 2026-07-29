import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { type District } from "@/lib/api";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { UpazilaSelect } from "@/components/district/UpazilaSelect";
import { useI18n } from "@/lib/i18n";
import { BLOOD_GROUPS } from "@/lib/format";
import { fetchCommunityDonors, type CommunityDonorRow } from "@/lib/community-donor-import";
import { upazilaDisplayName } from "@/data/bangladesh-clinics";
import { Droplet, Phone, Users, Building2 } from "lucide-react";
import { ChatHeaderButton } from "@/components/MessengerIcon";
import { UserMenuTrigger } from "@/components/menu/UserMenuDrawer";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/community")({
  head: () => ({ meta: [{ title: "Community — BloodLink" }] }),
  component: CommunityPage,
});

function CommunityPage() {
  const { lang } = useI18n();
  const [district, setDistrict] = useState<District | null>(null);
  const [upazila, setUpazila] = useState("");
  const [bloodGroup, setBloodGroup] = useState("ALL");
  const [donors, setDonors] = useState<CommunityDonorRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchCommunityDonors({
        bloodGroup,
        districtId: district?.id ?? null,
        upazila: upazila.trim() || undefined,
      });
      setDonors(data);
    } catch {
      setDonors([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("community-donors-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_donors" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloodGroup, district?.id, upazila]);

  return (
    <div className="w-full">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-xl safe-top px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <UserMenuTrigger />
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
              <Users className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight truncate">
                {lang === "bn" ? "রক্তদাতা খুঁজুন" : "Find blood donors"}
              </h1>
              <p className="text-[10px] text-muted-foreground truncate">
                {lang === "bn" ? "কমিউনিটি সংস্থার রক্তদাতা তালিকা" : "Community organization donor directory"}
              </p>
            </div>
          </div>
          <ChatHeaderButton />
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {["ALL", ...BLOOD_GROUPS].map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setBloodGroup(g)}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold border transition ${
                bloodGroup === g
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        <DistrictTypeahead
          value={district}
          onChange={(d) => {
            setDistrict(d);
            setUpazila("");
          }}
          placeholder={lang === "bn" ? "জেলা খুঁজুন…" : "Search district…"}
        />

        <UpazilaSelect district={district} value={upazila} onChange={setUpazila} />
      </header>

      <ul className="p-3 space-y-2 pb-8 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3 md:space-y-0">
        {loading && (
          <li className="text-center text-sm text-muted-foreground py-12">{lang === "bn" ? "খুঁজছি…" : "Searching…"}</li>
        )}
        {!loading && donors.length === 0 && (
          <li className="rounded-2xl border border-dashed bg-muted/20 py-16 px-6 text-center">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              {lang === "bn" ? "কোনো রক্তদাতা পাওয়া যায়নি" : "No donors found"}
            </p>
          </li>
        )}
        {donors.map((d) => (
          <DonorCard key={d.id} donor={d} lang={lang} />
        ))}
      </ul>
    </div>
  );
}

function DonorCard({ donor: d, lang }: { donor: CommunityDonorRow; lang: "bn" | "en" }) {
  const orgName = lang === "bn" ? d.community_orgs?.name_bn || d.community_orgs?.name : d.community_orgs?.name;
  const distName = lang === "bn" ? d.districts?.name_bn : d.districts?.name_en;
  const upazilaName = upazilaDisplayName(d.upazila, d.districts?.slug ?? null, lang);
  const location = [upazilaName, distName].filter(Boolean).join(" · ");

  return (
    <li className="rounded-2xl border bg-card px-3 py-3 flex items-center gap-3 shadow-sm">
      <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
        <Droplet className="h-5 w-5" fill="currentColor" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm truncate">{d.full_name}</p>
          {d.blood_group && (
            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
              {d.blood_group}
            </span>
          )}
        </div>
        {orgName && (
          <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1 truncate">
            <Building2 className="h-3 w-3 shrink-0" />
            {orgName}
          </p>
        )}
        {location && <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{location}</p>}
      </div>
      <a
        href={`tel:${d.phone.replace(/\s/g, "")}`}
        title={lang === "bn" ? "কল করুন" : "Call"}
        className="h-11 w-11 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-md shadow-primary/25 shrink-0 hover:opacity-90 transition"
      >
        <Phone className="h-5 w-5" />
      </a>
    </li>
  );
}
