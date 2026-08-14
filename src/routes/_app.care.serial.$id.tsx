import { createFileRoute } from "@tanstack/react-router";
import { CareSerialLivePage } from "@/components/care/CareSerialLivePage";

export const Route = createFileRoute("/_app/care/serial/$id")({
  component: CareSerialRoute,
});

function CareSerialRoute() {
  const { id } = Route.useParams();
  return <CareSerialLivePage serialId={id} />;
}
