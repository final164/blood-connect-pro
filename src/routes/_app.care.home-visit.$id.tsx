import { createFileRoute } from "@tanstack/react-router";
import { CareHomeVisitPage } from "@/components/care/CareHomeVisitPage";

export const Route = createFileRoute("/_app/care/home-visit/$id")({
  component: () => {
    const { id } = Route.useParams();
    return <CareHomeVisitPage bookingId={id} />;
  },
});
