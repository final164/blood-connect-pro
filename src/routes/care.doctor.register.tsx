import { createFileRoute } from "@tanstack/react-router";
import { APP_STYLESHEET } from "@/lib/app-stylesheet";
import { DoctorRegistrationPage } from "@/components/care/DoctorRegistrationPage";

export const Route = createFileRoute("/care/doctor/register")({
  head: () => ({
    meta: [
      { title: "Doctor Register — Muktosheba" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [APP_STYLESHEET],
  }),
  component: DoctorRegistrationPage,
});
