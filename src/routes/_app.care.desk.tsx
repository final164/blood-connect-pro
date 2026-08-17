import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/care/desk")({
  beforeLoad: () => {
    throw redirect({ to: "/care/portal/desk" });
  },
});
