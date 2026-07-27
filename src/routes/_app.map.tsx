import { createFileRoute, redirect } from "@tanstack/react-router";

/** Map removed — district typeahead replaces geo map UX */
export const Route = createFileRoute("/_app/map")({
  beforeLoad: () => {
    throw redirect({ to: "/requests" });
  },
  component: () => null,
});
