import { createFileRoute } from "@tanstack/react-router";
import { CareHubPage } from "@/components/care/CareHubPage";

type CareSearch = { tab?: string; specialty?: string };

export const Route = createFileRoute("/_app/care/")({
  validateSearch: (search: Record<string, unknown>): CareSearch => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
    specialty: typeof search.specialty === "string" ? search.specialty : undefined,
  }),
  component: CareIndex,
});

function CareIndex() {
  const { tab, specialty } = Route.useSearch();
  return <CareHubPage initialTab={tab} initialSpecialtyId={specialty} />;
}
