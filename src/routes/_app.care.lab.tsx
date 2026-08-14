import { createFileRoute } from "@tanstack/react-router";
import { CareLabDeskPage } from "@/components/care/CareLabDeskPage";

export const Route = createFileRoute("/_app/care/lab")({
  component: CareLabDeskPage,
});
