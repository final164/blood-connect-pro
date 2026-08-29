import { createFileRoute } from "@tanstack/react-router";
import { TeleDoctorPage } from "@/components/care/tele/TeleDoctorPage";

export const Route = createFileRoute("/_app/care/video/doctor/$id")({
  component: () => {
    const { id } = Route.useParams();
    return <TeleDoctorPage doctorId={id} />;
  },
});
