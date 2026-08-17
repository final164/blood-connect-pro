import { createFileRoute } from "@tanstack/react-router";
import { CareDeskPage } from "@/components/care/CareDeskPage";

export const Route = createFileRoute("/care/portal/desk")({
  component: () => <CareDeskPage portalMode />,
});
