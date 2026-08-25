import { createFileRoute } from "@tanstack/react-router";
import { CareLabFacilityPage } from "@/components/care/CareLabFacilityPage";

type LabsOrgSearch = { select?: string };

export const Route = createFileRoute("/_app/care/labs/$orgId")({
  validateSearch: (search: Record<string, unknown>): LabsOrgSearch => ({
    select: typeof search.select === "string" ? search.select : undefined,
  }),
  component: CareLabsOrgRoute,
});

function CareLabsOrgRoute() {
  const { orgId } = Route.useParams();
  const { select } = Route.useSearch();
  return <CareLabFacilityPage orgId={orgId} initialSelectId={select} />;
}
