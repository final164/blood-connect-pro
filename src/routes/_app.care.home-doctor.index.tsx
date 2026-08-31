import { createFileRoute } from "@tanstack/react-router";
import { CareHomeDoctorHubPage } from "@/components/care/CareHomeDoctorHubPage";

export const Route = createFileRoute("/_app/care/home-doctor/")({
  component: CareHomeDoctorHubPage,
});
