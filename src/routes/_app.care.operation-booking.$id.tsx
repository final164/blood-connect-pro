import { createFileRoute } from "@tanstack/react-router";
import { CareOperationBookingPage } from "@/components/care/CareOperationBookingPage";

export const Route = createFileRoute("/_app/care/operation-booking/$id")({
  component: CareOperationBookingRoute,
});

function CareOperationBookingRoute() {
  const { id } = Route.useParams();
  return <CareOperationBookingPage bookingId={id} />;
}
