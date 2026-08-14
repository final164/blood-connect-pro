import { createFileRoute } from "@tanstack/react-router";
import { CareLabBookingPage } from "@/components/care/CareLabBookingPage";

export const Route = createFileRoute("/_app/care/lab-booking/$id")({
  component: CareLabBookingRoute,
});

function CareLabBookingRoute() {
  const { id } = Route.useParams();
  return <CareLabBookingPage bookingId={id} />;
}
