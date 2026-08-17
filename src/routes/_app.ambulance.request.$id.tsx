import { createFileRoute } from "@tanstack/react-router";
import { AmbulanceRequestDetailPage } from "@/components/ambulance/AmbulanceRequestDetailPage";

export const Route = createFileRoute("/_app/ambulance/request/$id")({
  component: DetailRoute,
});

function DetailRoute() {
  const { id } = Route.useParams();
  return <AmbulanceRequestDetailPage requestId={id} />;
}
