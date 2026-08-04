import { createFileRoute } from "@tanstack/react-router";
import { buildRobotsTxt } from "@/lib/seo-settings";
import { fetchSeoSettingsServer } from "@/lib/seo-settings.server";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const seo = await fetchSeoSettingsServer();
        const origin = new URL(request.url).origin;
        const body = buildRobotsTxt(seo, origin);
        return new Response(body, {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      },
    },
  },
});
