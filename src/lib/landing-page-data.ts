import { createServerFn } from "@tanstack/react-start";

/** Server-only CMS fetch so the landing client bundle never imports Supabase. */
export const loadLandingPage = createServerFn({ method: "GET" }).handler(async () => {
  const [{ fetchSeoSettingsForLoader }, { fetchLandingSettingsForLoader }] = await Promise.all([
    import("@/lib/seo-settings"),
    import("@/lib/landing-settings"),
  ]);
  const [seo, settings] = await Promise.all([
    fetchSeoSettingsForLoader(80),
    fetchLandingSettingsForLoader(80),
  ]);
  return { seo, settings };
});
