import { createFileRoute } from "@tanstack/react-router";
import { CareVendorOnboardingPage } from "@/components/care/CareVendorOnboardingPage";

export const Route = createFileRoute("/care/portal/onboarding")({
  validateSearch: (search: Record<string, unknown>) => ({
    welcome: search.welcome === true || search.welcome === "true" ? true : undefined,
  }),
  component: CareVendorOnboardingPage,
});
