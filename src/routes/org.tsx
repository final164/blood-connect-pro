import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { APP_STYLESHEET } from "@/lib/app-stylesheet";

const OrgPortalPage = lazy(() =>
  import("./-org-page").then((m) => ({ default: m.OrgPortalPage })),
);

export const Route = createFileRoute("/org")({
  head: () => ({
    meta: [{ title: "Organization — BloodLink" }],
    links: [APP_STYLESHEET],
  }),
  component: () => (
    <Suspense fallback={<div className="min-h-dvh" style={{ background: "#F7F3F0" }} />}>
      <OrgPortalPage />
    </Suspense>
  ),
});
