import { createFileRoute } from "@tanstack/react-router";
import { CareAiTestsPage } from "@/components/care/CareAiTestsPage";

export const Route = createFileRoute("/_app/care/ai-tests")({
  component: CareAiTestsRoute,
});

function CareAiTestsRoute() {
  return <CareAiTestsPage />;
}
