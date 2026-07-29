import { createFileRoute, redirect } from "@tanstack/react-router";
import { ActivityFeedPage, isActivityView } from "@/components/menu/ActivityFeedPage";

export const Route = createFileRoute("/_app/me/$view")({
  head: ({ params }) => ({
    meta: [{ title: `${params.view} — BloodLink` }],
  }),
  beforeLoad: ({ params }) => {
    if (!isActivityView(params.view)) {
      throw redirect({ to: "/" });
    }
  },
  component: MeActivityRoute,
});

function MeActivityRoute() {
  const { view } = Route.useParams();
  if (!isActivityView(view)) return null;
  return <ActivityFeedPage view={view} />;
}
