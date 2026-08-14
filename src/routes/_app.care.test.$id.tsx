import { createFileRoute } from "@tanstack/react-router";
import { CareTestPage } from "@/components/care/CareTestPage";

export const Route = createFileRoute("/_app/care/test/$id")({
  component: CareTestRoute,
});

function CareTestRoute() {
  const { id } = Route.useParams();
  return <CareTestPage offeringId={id} />;
}
