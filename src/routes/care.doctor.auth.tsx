import { createFileRoute } from "@tanstack/react-router";
import { APP_STYLESHEET } from "@/lib/app-stylesheet";
import { DoctorAuthPage } from "@/components/care/DoctorAuthPage";

export const Route = createFileRoute("/care/doctor/auth")({
  head: () => ({
    meta: [
      { title: "Doctor Sign in — Muktosheba" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [APP_STYLESHEET],
  }),
  component: DoctorAuthPage,
});
