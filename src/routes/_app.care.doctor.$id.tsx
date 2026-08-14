import { createFileRoute } from "@tanstack/react-router";
import { CareDoctorPage } from "@/components/care/CareDoctorPage";

export const Route = createFileRoute("/_app/care/doctor/$id")({
  component: CareDoctorRoute,
});

function CareDoctorRoute() {
  const { id } = Route.useParams();
  return <CareDoctorPage doctorId={id} />;
}
