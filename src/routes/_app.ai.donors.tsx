import { createFileRoute } from "@tanstack/react-router";
import { BloodDonorAiPage } from "@/components/blood-donor-ai/BloodDonorAiPage";
import { APP_STYLESHEET } from "@/lib/app-stylesheet";

export const Route = createFileRoute("/_app/ai/donors")({
  head: () => ({
    meta: [{ title: "Blood Donor AI — Spandon" }],
    links: [APP_STYLESHEET],
  }),
  component: BloodDonorAiRoute,
});

function BloodDonorAiRoute() {
  return <BloodDonorAiPage />;
}
