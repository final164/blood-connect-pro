import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/care/lab")({
  beforeLoad: () => {
    throw redirect({ to: "/care/portal/lab" });
  },
});
