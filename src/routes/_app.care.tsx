import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/care")({
  component: CareLayout,
});

function CareLayout() {
  return <Outlet />;
}
