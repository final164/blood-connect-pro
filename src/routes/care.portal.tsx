import { createFileRoute, Outlet } from "@tanstack/react-router";
import { APP_STYLESHEET } from "@/lib/app-stylesheet";

export const Route = createFileRoute("/care/portal")({
  head: () => ({
    meta: [
      { title: "Care Portal — BloodLink" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [APP_STYLESHEET],
  }),
  component: () => <Outlet />,
});
