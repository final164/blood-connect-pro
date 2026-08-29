import { createFileRoute } from "@tanstack/react-router";
import { TeleBookingPage } from "@/components/care/tele/TeleBookingPage";

export const Route = createFileRoute("/_app/care/video/booking/$id")({
  component: () => {
    const { id } = Route.useParams();
    return <TeleBookingPage bookingId={id} />;
  },
});
