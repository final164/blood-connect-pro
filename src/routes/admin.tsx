import { createFileRoute } from "@tanstack/react-router";
import { APP_STYLESHEET } from "@/lib/app-stylesheet";
import { AdminPage } from "./-admin-page";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — BloodLink" }, { name: "robots", content: "noindex, nofollow" }],
    links: [APP_STYLESHEET],
  }),
  component: AdminPage,
});
