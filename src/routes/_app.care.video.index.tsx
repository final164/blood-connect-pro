import { createFileRoute } from "@tanstack/react-router";
import { TeleHubPage } from "@/components/care/tele/TeleHubPage";

export const Route = createFileRoute("/_app/care/video/")({
  component: TeleHubPage,
});
