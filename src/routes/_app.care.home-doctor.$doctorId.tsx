import { createFileRoute } from "@tanstack/react-router";
import { CareHomeDoctorPage } from "@/components/care/CareHomeDoctorPage";

export const Route = createFileRoute("/_app/care/home-doctor/$doctorId")({
  component: () => {
    const { doctorId } = Route.useParams();
    return <CareHomeDoctorPage doctorId={doctorId} />;
  },
});
