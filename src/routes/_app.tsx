import { createFileRoute } from "@tanstack/react-router";
import { APP_STYLESHEET } from "@/lib/app-stylesheet";
import { AppLayout } from "./-app-layout";

export const Route = createFileRoute("/_app")({
  head: () => ({ links: [APP_STYLESHEET] }),
  component: AppLayout,
});
