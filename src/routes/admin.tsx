import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { APP_STYLESHEET } from "@/lib/app-stylesheet";

const AdminPage = lazy(() =>
  import("./-admin-page").then((m) => ({ default: m.AdminPage })),
);

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — BloodLink" }, { name: "robots", content: "noindex, nofollow" }],
    links: [APP_STYLESHEET],
  }),
  component: () => (
    <Suspense fallback={<div className="min-h-dvh" style={{ background: "#F7F3F0" }} />}>
      <AdminPage />
    </Suspense>
  ),
});
