import { createFileRoute } from "@tanstack/react-router";
import { CareAmbulanceDeskPage } from "@/components/care/CareAmbulanceDeskPage";

export const Route = createFileRoute("/care/portal/ambulance")({
  component: () => <CareAmbulanceDeskPage portalMode />,
});
