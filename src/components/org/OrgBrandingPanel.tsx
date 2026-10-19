import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Camera, Eye, HardDrive, ImagePlus, Link2, Share2, X } from "lucide-react";
import { toast } from "sonner";
import {
  communityOrgPublicPath,
  communityOrgPublicUrl,
  resolveCommunityOrgImageUrl,
  updateCommunityOrgBranding,
  uploadCommunityOrgImage,
} from "@/lib/community-org-branding";
import { parseOrgPortalContent } from "@/lib/community-org-portal";
import { OrgPublicProfile } from "@/components/org/OrgPublicProfile";

type BrandingOrg = {
  id: string;
  name: string;
  name_bn: string | null;
  description: string | null;
  description_bn: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  is_verified?: boolean | null;
  portal_content?: unknown;
};

type ImageKind = "logo" | "cover";

export function OrgBrandingPanel({
  org,
  lang,
  canEdit,
  donorCount,
  openRequestCount,
  onUpdated,
}: {
  org: BrandingOrg;
  lang: "bn" | "en";
  canEdit: boolean;
  donorCount: number;
  openRequestCount: number;
  onUpdated: () => void;
}) {
  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<ImageKind | "link-logo" | "link-cover" | null>(null);
  const [viewAs, setViewAs] = useState(false);
  const [logoUrl, setLogoUrl] = useState(org.logo_url ?? null);
  const [coverUrl, setCoverUrl] = useState(org.cover_url ?? null);
  const [logoLink, setLogoLink] = useState("");
  const [coverLink, setCoverLink] = useState("");
  const [linkOpen, setLinkOpen] = useState<ImageKind | null>(null);

  useEffect(() => {
    setLogoUrl(org.logo_url ?? null);
    setCoverUrl(org.cover_url ?? null);
  }, [org.id, org.logo_url, org.cover_url]);

  const orgName = lang === "bn" ? org.name_bn || org.name : org.name;
  const portal = useMemo(
    () => parseOrgPortalContent(org.portal_content),
    [org.portal_content],
  );
  const desc =
    (lang === "bn"
      ? portal.about_bn || org.description_bn || org.description
      : portal.about_en || org.description || org.description_bn) || null;
  const welcome =
    lang === "bn"
      ? portal.advanced.welcome_bn || portal.advanced.welcome_en
      : portal.advanced.welcome_en || portal.advanced.welcome_bn;

  async function saveUrl(kind: ImageKind, url: string) {
    const patch = kind === "logo" ? { logo_url: url } : { cover_url: url };
    await updateCommunityOrgBranding(org.id, patch);
    if (kind === "logo") setLogoUrl(url);
    else setCoverUrl(url);
    onUpdated();
  }

  async function onPick(kind: ImageKind, file: File | null) {
    if (!file || !canEdit) return;
    if (!file.type.startsWith("image/")) {
      toast.error(lang === "bn" ? "শুধু ইমেজ আপলোড করুন" : "Upload an image only");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error(lang === "bn" ? "ম্যাক্স ৪ MB" : "Max 4 MB");
      return;
    }
    setBusy(kind);
    try {
      const url = await uploadCommunityOrgImage(file, lang);
      await saveUrl(kind, url);
      toast.success(
        lang === "bn"
          ? "Google Drive-এ আপলোড হয়েছে · লিংক সেভ"
          : "Uploaded to Google Drive · link saved",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onPasteLink(kind: ImageKind) {
    if (!canEdit) return;
    const raw = kind === "logo" ? logoLink : coverLink;
    setBusy(kind === "logo" ? "link-logo" : "link-cover");
    try {
      const url = await resolveCommunityOrgImageUrl(raw, lang);
      await saveUrl(kind, url);
      if (kind === "logo") setLogoLink("");
      else setCoverLink("");
      setLinkOpen(null);
      toast.success(
        lang === "bn" ? "Drive লিংক সেভ হয়েছে" : "Drive link saved",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function shareOrg() {
    const url = communityOrgPublicUrl(org.id);
    const title = orgName;
    try {
      if (navigator.share) {
        await navigator.share({ title, url, text: desc || title });
        return;
      }
    } catch {
      /* cancelled */
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(lang === "bn" ? "লিংক কপি হয়েছে" : "Link copied");
    } catch {
      toast.error(lang === "bn" ? "শেয়ার করা যায়নি" : "Could not share");
    }
  }

  function copyLink() {
    void navigator.clipboard
      .writeText(communityOrgPublicUrl(org.id))
      .then(() => toast.success(lang === "bn" ? "লিংক কপি হয়েছে" : "Link copied"))
      .catch(() => toast.error(lang === "bn" ? "কপি ব্যর্থ" : "Copy failed"));
  }

  return (
    <section className="space-y-3">
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="relative h-28 sm:h-36 bg-muted">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--primary) 35%, #1a1a1a), color-mix(in srgb, var(--primary) 12%, #2a2a2a))",
              }}
            />
          )}
          {canEdit && (
            <>
              <input
                ref={coverRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void onPick("cover", e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
              <div className="absolute right-2 bottom-2 flex gap-1.5">
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => setLinkOpen((v) => (v === "cover" ? null : "cover"))}
                  className="inline-flex items-center gap-1 rounded-lg bg-black/55 px-2 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm hover:bg-black/70 disabled:opacity-60"
                  title={lang === "bn" ? "Drive লিংক" : "Drive link"}
                >
                  <Link2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={busy === "cover"}
                  onClick={() => coverRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-black/55 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm hover:bg-black/70 disabled:opacity-60"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  {busy === "cover"
                    ? "…"
                    : lang === "bn"
                      ? "কভার → Drive"
                      : "Cover → Drive"}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="relative px-4 pb-4 pt-0">
          <div className="-mt-8 flex items-end gap-3">
            <div className="relative shrink-0">
              <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border-2 border-card bg-muted shadow-sm">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <Building2 className="h-7 w-7 text-primary" />
                )}
              </div>
              {canEdit && (
                <>
                  <input
                    ref={logoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      void onPick("logo", e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy === "logo"}
                    onClick={() => logoRef.current?.click()}
                    className="absolute -right-1 -bottom-1 grid h-7 w-7 place-items-center rounded-full border bg-card text-primary shadow-sm hover:bg-muted disabled:opacity-60"
                    title={lang === "bn" ? "লোগো → Google Drive" : "Logo → Google Drive"}
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
            <div className="min-w-0 flex-1 pb-0.5">
              <div className="flex items-center gap-1.5">
                <h2 className="truncate text-base font-bold">{orgName}</h2>
                {org.is_verified ? (
                  <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                    {lang === "bn" ? "ভেরিফাইড" : "Verified"}
                  </span>
                ) : null}
              </div>
              {org.phone ? (
                <p className="truncate text-xs text-muted-foreground">{org.phone}</p>
              ) : null}
            </div>
          </div>

          {canEdit && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-dashed border-primary/25 bg-primary/[0.04] px-3 py-2.5">
              <HardDrive className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {lang === "bn"
                  ? "ছবি Google Drive-এ যায় — সার্ভার/স্টোরেজে ফাইল রাখা হয় না। ডাটাবেসে শুধু লিংক সেভ হয়।"
                  : "Images go to Google Drive — nothing stored on our server. Only the link is saved in the database."}
              </p>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => setLinkOpen((v) => (v === "logo" ? null : "logo"))}
                className="ml-auto shrink-0 rounded-lg border px-2 py-1 text-[10px] font-semibold hover:bg-muted disabled:opacity-60"
              >
                {lang === "bn" ? "লোগো লিংক" : "Logo link"}
              </button>
            </div>
          )}

          {canEdit && linkOpen && (
            <div className="mt-2 flex gap-2">
              <input
                type="url"
                value={linkOpen === "logo" ? logoLink : coverLink}
                onChange={(e) =>
                  linkOpen === "logo"
                    ? setLogoLink(e.target.value)
                    : setCoverLink(e.target.value)
                }
                placeholder={
                  lang === "bn"
                    ? `${linkOpen === "logo" ? "লোগো" : "কভার"} — Google Drive / ইমেজ URL`
                    : `${linkOpen === "logo" ? "Logo" : "Cover"} — Google Drive / image URL`
                }
                className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/25"
              />
              <button
                type="button"
                disabled={
                  busy === (linkOpen === "logo" ? "link-logo" : "link-cover") ||
                  !(linkOpen === "logo" ? logoLink : coverLink).trim()
                }
                onClick={() => void onPasteLink(linkOpen)}
                className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy === (linkOpen === "logo" ? "link-logo" : "link-cover")
                  ? "…"
                  : lang === "bn"
                    ? "সেভ"
                    : "Save"}
              </button>
            </div>
          )}

          {desc ? (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground line-clamp-3">
              {desc}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setViewAs(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-muted"
            >
              <Eye className="h-3.5 w-3.5" />
              {lang === "bn" ? "ভিউ অ্যাজ" : "View as"}
            </button>
            <button
              type="button"
              onClick={() => void shareOrg()}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-muted"
            >
              <Share2 className="h-3.5 w-3.5" />
              {lang === "bn" ? "শেয়ার" : "Share"}
            </button>
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-muted"
            >
              <Link2 className="h-3.5 w-3.5" />
              {lang === "bn" ? "লিংক" : "Link"}
            </button>
            <a
              href={communityOrgPublicPath(org.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/15"
            >
              {lang === "bn" ? "পাবলিক পেজ" : "Public page"}
            </a>
          </div>
        </div>
      </div>

      {viewAs && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/55 backdrop-blur-[2px]"
          role="dialog"
          aria-modal
        >
          <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">
                {lang === "bn" ? "ভিউ অ্যাজ · পাবলিক পেজ" : "View as · Public page"}
              </p>
              <p className="truncate text-sm font-bold">{orgName}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={communityOrgPublicPath(org.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/20"
              >
                {lang === "bn" ? "নতুন ট্যাব" : "Open tab"}
              </a>
              <button
                type="button"
                onClick={() => setViewAs(false)}
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/25 bg-white/10 text-white hover:bg-white/20"
                aria-label={lang === "bn" ? "বন্ধ" : "Close"}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mx-auto mb-3 min-h-0 w-full max-w-lg flex-1 overflow-y-auto rounded-t-3xl border border-border/60 bg-background shadow-2xl sm:mb-6 sm:rounded-3xl">
            <OrgPublicProfile
              name={orgName}
              description={desc}
              welcome={welcome || null}
              logoUrl={logoUrl}
              coverUrl={coverUrl}
              phone={portal.advanced.show_phone_public ? org.phone : null}
              email={org.email}
              website={org.website}
              verified={portal.advanced.highlight_verified_badge && !!org.is_verified}
              donorCount={
                portal.advanced.show_donor_count_public ? donorCount : undefined
              }
              openRequestCount={
                portal.advanced.show_open_requests_public ? openRequestCount : undefined
              }
              faqs={portal.faqs}
              lang={lang}
              variant="full"
              onShare={() => void shareOrg()}
            />
          </div>
        </div>
      )}
    </section>
  );
}

export { OrgPublicCard } from "@/components/org/OrgPublicProfile";
