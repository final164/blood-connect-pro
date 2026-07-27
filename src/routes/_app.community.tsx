import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { fetchCommunityOrgs, type District } from "@/lib/api";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { useI18n } from "@/lib/i18n";
import { Building2, Globe, Phone, Mail, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/community")({
  head: () => ({ meta: [{ title: "Community — BloodLink" }] }),
  component: CommunityPage,
});

function CommunityPage() {
  const { lang } = useI18n();
  const [district, setDistrict] = useState<District | null>(null);
  const [orgs, setOrgs] = useState<any[]>([]);

  async function load() {
    try {
      const data = await fetchCommunityOrgs(district?.id ?? null);
      setOrgs(data);
    } catch {
      setOrgs([]);
    }
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("orgs-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_orgs" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district?.id]);

  return (
    <div className="mx-auto max-w-lg">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-xl safe-top px-4 py-3 space-y-2">
        <h1 className="text-base font-bold tracking-tight">
          {lang === "bn" ? "কমিউনিটি সংস্থা" : "Community organizations"}
        </h1>
        <p className="text-xs text-muted-foreground">
          {lang === "bn"
            ? "রক্তদান সংস্থাগুলোর সাথে যুক্ত থাকুন — অ্যাডমিন প্যানেল থেকে ম্যানেজ হয়"
            : "Connect with blood donation organizations — managed from admin panel"}
        </p>
        <DistrictTypeahead value={district} onChange={setDistrict} />
      </header>

      <ul className="p-3 space-y-3">
        {orgs.length === 0 && (
          <li className="text-center text-sm text-muted-foreground py-16">
            {lang === "bn" ? "এখনো কোনো সংস্থা নেই" : "No organizations yet"}
          </li>
        )}
        {orgs.map((o) => (
          <li key={o.id} className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0 overflow-hidden">
                {o.logo_url ? <img src={o.logo_url} alt="" className="h-full w-full object-cover" /> : <Building2 className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="font-semibold text-sm truncate">
                    {lang === "bn" ? o.name_bn || o.name : o.name}
                  </h2>
                  {o.is_verified && <BadgeCheck className="h-4 w-4 text-primary shrink-0" />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {lang === "bn" ? o.description_bn || o.description : o.description}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {o.phone && (
                    <a href={`tel:${o.phone}`} className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-medium">
                      <Phone className="h-3 w-3" /> {o.phone}
                    </a>
                  )}
                  {o.email && (
                    <a href={`mailto:${o.email}`} className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-medium">
                      <Mail className="h-3 w-3" /> Email
                    </a>
                  )}
                  {o.website && (
                    <a href={o.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-primary/10 text-primary px-2 py-1 text-[11px] font-medium">
                      <Globe className="h-3 w-3" /> Web
                    </a>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
