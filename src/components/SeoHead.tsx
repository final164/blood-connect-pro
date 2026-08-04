import { useEffect } from "react";
import {
  absoluteUrl,
  buildHead,
  buildJsonLd,
  type SeoSettings,
} from "@/lib/seo-settings";

function upsertMeta(nameOrProperty: string, content: string, isProperty = false) {
  if (typeof document === "undefined" || !content) return;
  const attr = isProperty ? "property" : "name";
  let el = document.head.querySelector(`meta[${attr}="${nameOrProperty}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, nameOrProperty);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string, hrefLang?: string) {
  if (typeof document === "undefined" || !href) return;
  const selector = hrefLang
    ? `link[rel="${rel}"][hreflang="${hrefLang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let el = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    if (hrefLang) el.hreflang = hrefLang;
    document.head.appendChild(el);
  }
  el.href = href;
}

function upsertJsonLd(id: string, data: Record<string, unknown> | null) {
  if (typeof document === "undefined") return;
  const existing = document.getElementById(id);
  if (!data) {
    existing?.remove();
    return;
  }
  const el = existing ?? document.createElement("script");
  el.id = id;
  el.type = "application/ld+json";
  el.textContent = JSON.stringify(data);
  if (!existing) document.head.appendChild(el);
}

export function SeoHeadUpdater({
  seo,
  lang,
}: {
  seo: SeoSettings;
  lang: "bn" | "en";
}) {
  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { meta, links } = buildHead(seo, lang, origin);

    for (const tag of meta) {
      if ("title" in tag) {
        document.title = tag.title;
      } else if ("property" in tag) {
        upsertMeta(tag.property, tag.content, true);
      } else {
        upsertMeta(tag.name, tag.content);
      }
    }

    for (const link of links) {
      upsertLink(link.rel, link.href, link.hrefLang);
    }

    const jsonLd = buildJsonLd(seo, lang, origin);
    upsertJsonLd("bloodlink-seo-jsonld", jsonLd);
  }, [seo, lang]);

  return null;
}

export function SeoJsonLd({
  seo,
  lang,
}: {
  seo: SeoSettings;
  lang: "bn" | "en";
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const data = buildJsonLd(seo, lang, origin);
  if (!data) return null;
  return (
    <script
      id="bloodlink-seo-jsonld-ssr"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function previewOgImage(seo: SeoSettings, origin = ""): string {
  return absoluteUrl(seo.og_image_url || "/icon-512.png", seo, origin);
}
