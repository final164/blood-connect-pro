import { createFileRoute } from "@tanstack/react-router";
import { CareLabFacilityPage } from "@/components/care/CareLabFacilityPage";

type LabsOrgSearch = {
  /** Comma-separated offering ids */
  select?: string;
  /** Comma-separated catalog ids (from AI chat / deep links) */
  catalogs?: string;
};

function splitIds(raw?: string) {
  if (!raw?.trim()) return undefined;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length ? ids : undefined;
}

export const Route = createFileRoute("/_app/care/labs/$orgId")({
  validateSearch: (search: Record<string, unknown>): LabsOrgSearch => ({
    select: typeof search.select === "string" ? search.select : undefined,
    catalogs: typeof search.catalogs === "string" ? search.catalogs : undefined,
  }),
  component: CareLabsOrgRoute,
});

function CareLabsOrgRoute() {
  const { orgId } = Route.useParams();
  const { select, catalogs } = Route.useSearch();
  return (
    <CareLabFacilityPage
      orgId={orgId}
      initialSelectId={splitIds(select)?.[0]}
      initialSelectIds={splitIds(select)}
      initialCatalogIds={splitIds(catalogs)}
    />
  );
}
