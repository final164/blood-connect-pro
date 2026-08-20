import { createFileRoute } from "@tanstack/react-router";
import { APP_STYLESHEET } from "@/lib/app-stylesheet";
import { isSafeNextPath } from "@/lib/auth-next";
import { AuthPage } from "./-auth-page";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    next: isSafeNextPath(search.next) ? search.next : undefined,
  }),
  head: () => ({
    meta: [{ title: "Sign in — BloodLink" }, { name: "robots", content: "noindex, nofollow" }],
    links: [APP_STYLESHEET],
  }),
  component: AuthPage,
});
