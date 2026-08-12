import { QueryClient } from "@tanstack/react-query";

/** Shared React Query defaults: keep lists warm so tab switches skip spinners. */
export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 15 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 1,
      },
    },
  });
}

export const queryKeys = {
  feed: (filter: string, districtId: string | null | undefined, userId: string | undefined) =>
    ["feed", filter, districtId ?? null, userId ?? null] as const,
  communityDonors: (q: {
    bloodGroup: string;
    districtId: string | null | undefined;
    upazila: string;
    orgId: string | null | undefined;
    sortUnavailableLast?: boolean;
    includeAppUsers?: boolean;
  }) =>
    [
      "community-donors",
      q.bloodGroup,
      q.districtId ?? null,
      q.upazila || "",
      q.orgId ?? null,
      q.sortUnavailableLast !== false,
      q.includeAppUsers !== false,
    ] as const,
  activity: (view: string, userId: string | undefined) =>
    ["activity", view, userId ?? null] as const,
  profile: (userId: string | undefined) => ["profile", userId ?? null] as const,
  profileLock: ["profile-lock-settings"] as const,
  publicProfile: (userId: string) => ["public-profile", userId] as const,
};
