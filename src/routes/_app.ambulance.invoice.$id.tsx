import { createFileRoute } from "@tanstack/react-router";
import { AmbulanceInvoicePage } from "@/components/ambulance/AmbulanceInvoicePage";

export const Route = createFileRoute("/_app/ambulance/invoice/$id")({
  component: InvoiceRoute,
});

function InvoiceRoute() {
  const { id } = Route.useParams();
  return <AmbulanceInvoicePage requestId={id} />;
}
