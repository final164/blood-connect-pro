import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { APP_STYLESHEET } from "@/lib/app-stylesheet";

const AuthPage = lazy(() =>
  import("./-auth-page").then((m) => ({ default: m.AuthPage })),
);

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "Sign in — BloodLink" }, { name: "robots", content: "noindex, nofollow" }],
    links: [APP_STYLESHEET],
  }),
  component: () => (
    <Suspense fallback={<div className="min-h-dvh" style={{ background: "#F7F3F0" }} />}>
      <AuthPage />
    </Suspense>
  ),
});
