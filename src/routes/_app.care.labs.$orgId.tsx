import { createFileRoute } from "@tanstack/react-router";
import { CareLabFacilityPage } from "@/components/care/CareLabFacilityPage";

export const Route = createFileRoute("/_app/care/labs/$orgId")({
  component: CareLabsOrgRoute,
});

function CareLabsOrgRoute() {
  const { orgId } = Route.useParams();
  return <CareLabFacilityPage orgId={orgId} />;
}
