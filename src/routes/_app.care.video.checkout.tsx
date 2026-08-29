import { createFileRoute } from "@tanstack/react-router";
import { TeleCheckoutPage } from "@/components/care/tele/TeleCheckoutPage";

type Search = {
  mode?: "named" | "instant";
  doctorId?: string;
  specialtyId?: string;
  offerId?: string;
  slotStart?: string;
  slotEnd?: string;
};

export const Route = createFileRoute("/_app/care/video/checkout")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const doctorId = typeof s.doctorId === "string" ? s.doctorId : undefined;
    const mode =
      s.mode === "named" || s.mode === "instant"
        ? s.mode
        : doctorId
          ? "named"
          : "instant";
    return {
      mode,
      doctorId,
      specialtyId: typeof s.specialtyId === "string" ? s.specialtyId : undefined,
      offerId: typeof s.offerId === "string" ? s.offerId : undefined,
      slotStart: typeof s.slotStart === "string" ? s.slotStart : undefined,
      slotEnd: typeof s.slotEnd === "string" ? s.slotEnd : undefined,
    };
  },
  component: () => {
    const search = Route.useSearch();
    return (
      <TeleCheckoutPage
        mode={search.mode ?? "instant"}
        doctorId={search.doctorId}
        specialtyId={search.specialtyId}
        offerId={search.offerId}
        slotStart={search.slotStart}
        slotEnd={search.slotEnd}
      />
    );
  },
});
