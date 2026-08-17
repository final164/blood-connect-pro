import { createFileRoute } from "@tanstack/react-router";
import { AmbulanceProviderPage } from "@/components/ambulance/AmbulanceProviderPage";

export const Route = createFileRoute("/_app/ambulance/provider/$orgId")({
  component: ProviderRoute,
});

function ProviderRoute() {
  const { orgId } = Route.useParams();
  return <AmbulanceProviderPage orgId={orgId} />;
}
