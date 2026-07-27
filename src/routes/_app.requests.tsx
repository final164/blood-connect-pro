import { createFileRoute, redirect } from "@tanstack/react-router";

/** Requests live on Feed — keep route for old links */
export const Route = createFileRoute("/_app/requests")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: () => null,
});
