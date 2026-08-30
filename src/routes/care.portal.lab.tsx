import { createFileRoute } from "@tanstack/react-router";
import { CareLabDeskPage } from "@/components/care/CareLabDeskPage";

export const Route = createFileRoute("/care/portal/lab")({
  component: () => <CareLabDeskPage portalMode deskScope="lab" />,
});
