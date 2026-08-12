import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/profile")({
  component: ProfileLayout,
});

/** Layout so /profile and /profile/$userId don't fight — chat-style Outlet. */
function ProfileLayout() {
  return <Outlet />;
}
