import { createFileRoute } from "@tanstack/react-router";
import { ConsultantTeleDesk } from "@/components/care/tele/ConsultantTeleDesk";

export const Route = createFileRoute("/care/portal/tele")({
  component: ConsultantTeleDesk,
});
