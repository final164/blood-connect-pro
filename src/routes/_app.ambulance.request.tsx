import { createFileRoute } from "@tanstack/react-router";
import { AmbulanceRequestPage } from "@/components/ambulance/AmbulanceRequestPage";

type Search = { mode?: "emergency" | "scheduled"; orgId?: string };

export const Route = createFileRoute("/_app/ambulance/request")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    mode: s.mode === "scheduled" ? "scheduled" : s.mode === "emergency" ? "emergency" : undefined,
    orgId: typeof s.orgId === "string" ? s.orgId : undefined,
  }),
  component: RequestRoute,
});

function RequestRoute() {
  const { mode, orgId } = Route.useSearch();
  return <AmbulanceRequestPage initialMode={mode ?? "emergency"} orgId={orgId} />;
}
