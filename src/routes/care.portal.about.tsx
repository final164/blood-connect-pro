import { createFileRoute } from "@tanstack/react-router";
import { CarePortalInstitutePage } from "@/components/care/CarePortalInstitutePage";

export const Route = createFileRoute("/care/portal/about")({
  component: CarePortalInstitutePage,
});
