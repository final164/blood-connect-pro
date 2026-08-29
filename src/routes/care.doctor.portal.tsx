import { createFileRoute } from "@tanstack/react-router";
import { APP_STYLESHEET } from "@/lib/app-stylesheet";
import { DoctorPortalPage } from "@/components/care/DoctorPortalPage";

export const Route = createFileRoute("/care/doctor/portal")({
  head: () => ({
    meta: [
      { title: "Doctor Portal — Muktosheba" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [APP_STYLESHEET],
  }),
  component: DoctorPortalPage,
});
