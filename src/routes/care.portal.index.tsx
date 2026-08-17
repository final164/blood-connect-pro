import { createFileRoute } from "@tanstack/react-router";
import { CarePortalHome } from "@/components/care/CarePortalHome";

export const Route = createFileRoute("/care/portal/")({
  component: CarePortalHome,
});
