import { useEffect, useRef, useState } from "react";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  fetchCareOrgPublicProfile,
  newFaqItem,
  saveOrgAboutSettings,
  saveOrgLogoUrl,
  uploadCareOrgImage,
  type CareOrgFaqItem,
  type CareOrgPublicProfile,
} from "@/lib/care-org-about";
import { fetchOrgGalleryMaxImages } from "@/lib/care-cms";
import { fetchOrgSettings } from "@/lib/care-org-settings";
import { useCarePortalLayout } from "@/components/care/CarePortalLayout";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { cn } from "@/lib/utils";

export function CarePortalInstitutePage() {
  const { orgId, desktopShell, lang, ready } = useCarePortalLayout();
  const bn = lang === "bn";
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<CareOrgPublicProfile | null>(null);
  const [aboutBn, setAboutBn] = useState("");
  const [aboutEn, setAboutEn] = useState("");
  const [gallery, setGallery] = useState<string[]>([]);
  const [faqs, setFaqs] = useState<CareOrgFaqItem[]>([]);
  const [galleryMax, setGalleryMax] = useState(8);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function reload(id: string) {
    setLoading(true);
    try {
      const [p, max] = await Promise.all([
        fetchCareOrgPublicProfile(id),
        fetchOrgGalleryMaxImages(),
      ]);
      setProfile(p);
      setGalleryMax(max);
      setAboutBn(p?.about.about_bn || p?.description_bn || "");
      setAboutEn(p?.about.about_en || p?.description || "");
      setGallery(p?.about.gallery ?? []);
      setFaqs(p?.about.faqs?.length ? p.about.faqs : []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!orgId) return;
    void reload(orgId);
  }, [orgId]);

  const atGalleryLimit = gallery.length >= galleryMax;

  async function onUpload(file: File | null) {
    if (!file || !orgId) return;
    if (!file.type.startsWith("image/")) {
      toast.error(bn ? "শুধু ছবি আপলোড করুন" : "Upload an image file");
      return;
    }
    if (gallery.length >= galleryMax) {
      toast.error(
        bn
          ? `সর্বোচ্চ ${galleryMax}টি ছবি আপলোড করা যাবে`
          : `Maximum ${galleryMax} photos allowed`,
      );
      return;
    }
    setUploading(true);
    try {
      const url = await uploadCareOrgImage(file);
      const next = [...gallery, url].slice(0, galleryMax);
      setGallery(next);
      if (!profile?.logo_url && next[0]) {
        await saveOrgLogoUrl(orgId, next[0]!);
        setProfile((p) => (p ? { ...p, logo_url: next[0]! } : p));
      }
      toast.success(bn ? "ছবি আপলোড হয়েছে" : "Image uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    if (!orgId) return;
    setSaving(true);
    try {
      const existing = await fetchOrgSettings(orgId);
      const clipped = gallery.slice(0, galleryMax);
      await saveOrgAboutSettings(
        orgId,
        {
          about_bn: aboutBn,
          about_en: aboutEn,
          gallery: clipped,
          faqs: faqs.filter((f) => f.question_bn.trim() || f.question_en.trim()),
        },
        existing,
      );
      if (clipped[0] && !profile?.logo_url) {
        await saveOrgLogoUrl(orgId, clipped[0]);
      }
      toast.success(bn ? "সংরক্ষিত" : "Saved");
      await reload(orgId);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!ready || !orgId) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-700 border-t-transparent" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-700 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className={cn("min-h-dvh bg-background", desktopShell && "md:min-h-0")}>
      {!desktopShell && (
        <header className="border-b bg-card/80 px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <PageBackButton fallbackTo="/care/portal" shape="xl" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {bn ? "ইনস্টিটিউট" : "Institute"}
              </p>
              <h1 className="text-base font-bold">{bn ? "প্রতিষ্ঠান সম্পর্কে" : "About institute"}</h1>
            </div>
          </div>
        </header>
      )}

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 md:max-w-4xl">
        <section className="space-y-3 rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold">{bn ? "প্রতিষ্ঠানের ছবি" : "Institute photos"}</h2>
              <p className="text-xs text-muted-foreground">
                {bn
                  ? `আপলোড করলে লিঙ্ক সেভ হবে · ${gallery.length}/${galleryMax}`
                  : `Upload creates a saved public link · ${gallery.length}/${galleryMax}`}
              </p>
            </div>
            <button
              type="button"
              disabled={uploading || atGalleryLimit}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50"
              title={
                atGalleryLimit
                  ? bn
                    ? `সর্বোচ্চ ${galleryMax}টি`
                    : `Max ${galleryMax}`
                  : undefined
              }
            >
              <ImagePlus className="h-3.5 w-3.5" />
              {uploading
                ? bn
                  ? "আপলোড…"
                  : "Uploading…"
                : atGalleryLimit
                  ? bn
                    ? "লিমিট পূর্ণ"
                    : "Limit reached"
                  : bn
                    ? "ছবি যোগ"
                    : "Add photo"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onUpload(e.target.files?.[0] ?? null)}
            />
          </div>
          {gallery.length === 0 ? (
            <p className="rounded-xl border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
              {bn ? "এখনো কোনো ছবি নেই" : "No photos yet"}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {gallery.map((url) => (
                <div key={url} className="group relative aspect-[4/3] overflow-hidden rounded-xl border">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setGallery((g) => g.filter((u) => u !== url))}
                    className="absolute right-1.5 top-1.5 rounded-md border bg-card/90 p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border bg-card p-4">
          <h2 className="text-sm font-bold">{bn ? "আমাদের সম্পর্কে" : "About us"}</h2>
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">বাংলা</span>
            <textarea
              rows={5}
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
              value={aboutBn}
              onChange={(e) => setAboutBn(e.target.value)}
              placeholder="প্রতিষ্ঠানের পরিচিতি, সেবা ও বিশেষত্ব…"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">English</span>
            <textarea
              rows={5}
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
              value={aboutEn}
              onChange={(e) => setAboutEn(e.target.value)}
              placeholder="Institute overview, services and specialties…"
            />
          </label>
        </section>

        <section className="space-y-3 rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold">{bn ? "প্রশ্নোত্তর (Q/A)" : "Q & A"}</h2>
            <button
              type="button"
              onClick={() => setFaqs((f) => [...f, newFaqItem()])}
              className="inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              {bn ? "যোগ" : "Add"}
            </button>
          </div>
          {!faqs.length && (
            <p className="text-xs text-muted-foreground">
              {bn ? "সাধারণ প্রশ্ন যোগ করুন" : "Add frequently asked questions"}
            </p>
          )}
          {faqs.map((faq, idx) => (
            <div key={faq.id} className="space-y-2 rounded-xl border border-dashed p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-muted-foreground">#{idx + 1}</p>
                <button
                  type="button"
                  onClick={() => setFaqs((list) => list.filter((f) => f.id !== faq.id))}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                placeholder={bn ? "প্রশ্ন (বাংলা)" : "Question (BN)"}
                value={faq.question_bn}
                onChange={(e) =>
                  setFaqs((list) =>
                    list.map((f) => (f.id === faq.id ? { ...f, question_bn: e.target.value } : f)),
                  )
                }
              />
              <input
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                placeholder="Question (EN)"
                value={faq.question_en}
                onChange={(e) =>
                  setFaqs((list) =>
                    list.map((f) => (f.id === faq.id ? { ...f, question_en: e.target.value } : f)),
                  )
                }
              />
              <textarea
                rows={2}
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                placeholder={bn ? "উত্তর (বাংলা)" : "Answer (BN)"}
                value={faq.answer_bn}
                onChange={(e) =>
                  setFaqs((list) =>
                    list.map((f) => (f.id === faq.id ? { ...f, answer_bn: e.target.value } : f)),
                  )
                }
              />
              <textarea
                rows={2}
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                placeholder="Answer (EN)"
                value={faq.answer_en}
                onChange={(e) =>
                  setFaqs((list) =>
                    list.map((f) => (f.id === faq.id ? { ...f, answer_en: e.target.value } : f)),
                  )
                }
              />
            </div>
          ))}
        </section>

        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="w-full rounded-xl bg-teal-700 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? (bn ? "সংরক্ষণ…" : "Saving…") : bn ? "সব সংরক্ষণ করুন" : "Save all"}
        </button>
      </main>
    </div>
  );
}
