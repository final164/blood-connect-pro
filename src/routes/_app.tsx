import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { APP_STYLESHEET } from "@/lib/app-stylesheet";

const AppLayout = lazy(() =>
  import("./-app-layout").then((m) => ({ default: m.AppLayout })),
);

export const Route = createFileRoute("/_app")({
  head: () => ({ links: [APP_STYLESHEET] }),
  component: () => (
    <Suspense fallback={<div className="min-h-dvh" style={{ background: "#F7F3F0" }} />}>
      <AppLayout />
    </Suspense>
  ),
});
