import { createFileRoute } from "@tanstack/react-router";
import { APP_STYLESHEET } from "@/lib/app-stylesheet";
import { OrgPortalPage } from "./-org-page";

export const Route = createFileRoute("/org")({
  head: () => ({
    meta: [{ title: "Organization — Muktosheba" }],
    links: [APP_STYLESHEET],
  }),
  component: OrgPortalPage,
});
