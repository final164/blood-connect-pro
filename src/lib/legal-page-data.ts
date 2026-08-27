import { createServerFn } from "@tanstack/react-start";

/**
 * Server-only CMS fetch for the legal pages so the client bundle never imports Supabase.
 * Unlike the landing loader this awaits the data: legal pages are cold-loaded, SEO-indexed,
 * and must never render stale defaults to a crawler.
 */
export const loadLegalPages = createServerFn({ method: "GET" }).handler(async () => {
  const [{ fetchSeoSettingsServer }, { fetchLegalSettingsServer }] = await Promise.all([
    import("@/lib/seo-settings.server"),
    import("@/lib/legal-settings.server"),
  ]);
  const [seo, legal] = await Promise.all([
    fetchSeoSettingsServer(),
    fetchLegalSettingsServer(),
  ]);
  // Fall back to the serving origin so canonical URLs stay absolute even when
  // seo.site_url has not been configured yet.
  let origin = "";
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    origin = new URL(getRequest().url).origin;
  } catch {
    /* no request context */
  }
  return { seo, legal, origin };
});
