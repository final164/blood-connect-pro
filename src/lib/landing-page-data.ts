import { createServerFn } from "@tanstack/react-start";

/** Server-only CMS fetch so the landing client bundle never imports Supabase. */
export const loadLandingPage = createServerFn({ method: "GET" }).handler(async () => {
  const [{ fetchSeoSettingsForLoader }, { fetchLandingSettingsForLoader }] = await Promise.all([
    import("@/lib/seo-settings"),
    import("@/lib/landing-settings"),
  ]);
  // Never stall first HTML on CMS — warm cache if ready, otherwise defaults + background fetch.
  const [seo, settings] = await Promise.all([
    fetchSeoSettingsForLoader(0),
    fetchLandingSettingsForLoader(0),
  ]);
  return { seo, settings };
});
