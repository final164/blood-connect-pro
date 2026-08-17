import { createFileRoute } from "@tanstack/react-router";
import { AmbulanceHubPage } from "@/components/ambulance/AmbulanceHubPage";

export const Route = createFileRoute("/_app/ambulance/")({
  component: AmbulanceHubPage,
});
