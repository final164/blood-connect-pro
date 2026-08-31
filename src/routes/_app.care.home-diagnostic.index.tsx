import { createFileRoute } from "@tanstack/react-router";
import { CareHomeDiagnosticPage } from "@/components/care/CareHomeDiagnosticPage";

export const Route = createFileRoute("/_app/care/home-diagnostic/")({
  component: CareHomeDiagnosticPage,
});
