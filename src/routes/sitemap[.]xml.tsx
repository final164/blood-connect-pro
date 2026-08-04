import { createFileRoute } from "@tanstack/react-router";
import { buildSitemapXml } from "@/lib/seo-settings";
import { fetchSeoSettingsServer } from "@/lib/seo-settings.server";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const seo = await fetchSeoSettingsServer();
        if (!seo.sitemap_enabled) {
          return new Response("Sitemap disabled", { status: 404 });
        }
        const origin = new URL(request.url).origin;
        const body = buildSitemapXml(seo, origin);
        return new Response(body, {
          headers: { "Content-Type": "application/xml; charset=utf-8" },
        });
      },
    },
  },
});
