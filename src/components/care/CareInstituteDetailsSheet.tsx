import { useEffect, useState } from "react";
import { Building2, Globe, Mail, MapPin, Phone } from "lucide-react";
import {
  fetchCareOrgPublicProfile,
  type CareOrgPublicProfile,
} from "@/lib/care-org-about";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function CareInstituteDetailsSheet({
  orgId,
  open,
  onOpenChange,
  lang,
}: {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lang: "bn" | "en";
}) {
  const bn = lang === "bn";
  const [profile, setProfile] = useState<CareOrgPublicProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !orgId) return;
    let cancelled = false;
    setLoading(true);
    void fetchCareOrgPublicProfile(orgId)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, orgId]);

  const title = bn ? profile?.name_bn || profile?.name : profile?.name || profile?.name_bn;
  const about =
    (bn ? profile?.about.about_bn || profile?.description_bn : profile?.about.about_en || profile?.description) ||
    (bn ? profile?.about.about_en || profile?.description : profile?.about.about_bn || profile?.description_bn) ||
    "";
  const gallery = profile?.about.gallery?.length
    ? profile.about.gallery
    : profile?.logo_url
      ? [profile.logo_url]
      : [];
  const faqs = (profile?.about.faqs ?? []).filter(
    (f) => (bn ? f.question_bn || f.question_en : f.question_en || f.question_bn).trim(),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>{bn ? "প্রতিষ্ঠানের বিস্তারিত" : "Institute details"}</SheetTitle>
          <SheetDescription>
            {title || (bn ? "প্রোফাইল লোড হচ্ছে…" : "Loading profile…")}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="grid place-items-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-700 border-t-transparent" />
          </div>
        ) : !profile ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {bn ? "তথ্য পাওয়া যায়নি" : "Details unavailable"}
          </p>
        ) : (
          <div className="mt-4 space-y-5 pb-6">
            <div className="flex gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border bg-muted">
                {profile.logo_url || gallery[0] ? (
                  <img
                    src={profile.logo_url || gallery[0]}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-muted-foreground">
                    <Building2 className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-bold">{title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[profile.upazila, profile.address].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
            </div>

            {gallery.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {gallery.map((url) => (
                  <img
                    key={url}
                    src={url}
                    alt=""
                    className="h-28 w-40 shrink-0 rounded-xl border object-cover"
                  />
                ))}
              </div>
            )}

            {about ? (
              <section className="space-y-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {bn ? "আমাদের সম্পর্কে" : "About us"}
                </h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{about}</p>
              </section>
            ) : null}

            <section className="space-y-2 rounded-xl border p-3 text-sm">
              {profile.phone ? (
                <a href={`tel:${profile.phone}`} className="flex items-center gap-2 hover:text-teal-800">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  {profile.phone}
                </a>
              ) : null}
              {profile.email ? (
                <a href={`mailto:${profile.email}`} className="flex items-center gap-2 hover:text-teal-800">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  {profile.email}
                </a>
              ) : null}
              {profile.website ? (
                <a
                  href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 hover:text-teal-800"
                >
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  {profile.website}
                </a>
              ) : null}
              {(profile.address || profile.upazila) && (
                <p className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{[profile.address, profile.upazila].filter(Boolean).join(", ")}</span>
                </p>
              )}
            </section>

            {faqs.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {bn ? "প্রশ্নোত্তর" : "Q & A"}
                </h3>
                <Accordion type="single" collapsible className="rounded-xl border px-3">
                  {faqs.map((f) => {
                    const q = bn ? f.question_bn || f.question_en : f.question_en || f.question_bn;
                    const a = bn ? f.answer_bn || f.answer_en : f.answer_en || f.answer_bn;
                    return (
                      <AccordionItem key={f.id} value={f.id}>
                        <AccordionTrigger className="text-left text-sm">{q}</AccordionTrigger>
                        <AccordionContent className="whitespace-pre-wrap text-sm text-muted-foreground">
                          {a || "—"}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
