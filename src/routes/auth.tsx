import { createFileRoute } from "@tanstack/react-router";
import { APP_STYLESHEET } from "@/lib/app-stylesheet";
import { AuthPage } from "./-auth-page";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "Sign in — BloodLink" }, { name: "robots", content: "noindex, nofollow" }],
    links: [APP_STYLESHEET],
  }),
  component: AuthPage,
});
