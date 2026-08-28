import { createFileRoute } from "@tanstack/react-router";
import { CareOperationPage } from "@/components/care/CareOperationPage";

export const Route = createFileRoute("/_app/care/operation/$offeringId")({
  component: CareOperationDetailRoute,
});

function CareOperationDetailRoute() {
  const { offeringId } = Route.useParams();
  return <CareOperationPage offeringId={offeringId} />;
}
