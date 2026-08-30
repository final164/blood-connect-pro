import { createFileRoute } from "@tanstack/react-router";
import { APP_STYLESHEET } from "@/lib/app-stylesheet";
import { CarePortalLayout } from "@/components/care/CarePortalLayout";

export const Route = createFileRoute("/care/portal")({
  head: () => ({
    meta: [
      { title: "Care Portal — Muktosheba" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [APP_STYLESHEET],
  }),
  component: CarePortalLayout,
});
