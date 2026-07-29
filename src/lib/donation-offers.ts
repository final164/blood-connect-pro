import { supabase } from "@/integrations/supabase/client";

export type DonationOfferStatus =
  | "interested"
  | "donated_claimed"
  | "confirmed"
  | "rejected"
  | "cancelled";

export type DonationOfferSource = "self" | "assigned";

export type DonationOffer = {
  id: string;
  request_id: string;
  donor_id: string;
  status: DonationOfferStatus;
  source: DonationOfferSource;
  bags: number;
  donation_date: string | null;
  notes: string | null;
  assigned_by: string | null;
  donation_id: string | null;
  created_at: string;
  updated_at?: string;
  donor?: { id: string; full_name: string | null; avatar_url: string | null; blood_group: string | null } | null;
};

export function bagsConfirmed(offers: DonationOffer[]) {
  return offers
    .filter((o) => o.status === "confirmed")
    .reduce((sum, o) => sum + (o.bags || 1), 0);
}

export async function fetchOffersForRequests(requestIds: string[]): Promise<DonationOffer[]> {
  if (!requestIds.length) return [];
  const { data, error } = await supabase
    .from("request_donation_offers")
    .select("*")
    .in("request_id", requestIds)
    .order("created_at", { ascending: true });
  if (error) {
    if (/request_donation_offers|relation|column/i.test(error.message)) return [];
    throw error;
  }
  const list = (data ?? []) as DonationOffer[];
  const donorIds = [...new Set(list.map((o) => o.donor_id))];
  if (!donorIds.length) return list;
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, blood_group")
    .in("id", donorIds);
  const map = new Map((profiles ?? []).map((p) => [p.id, p]));
  return list.map((o) => ({ ...o, donor: map.get(o.donor_id) ?? null }));
}

export async function expressInterest(requestId: string, donorId: string) {
  const { data, error } = await supabase
    .from("request_donation_offers")
    .insert({
      request_id: requestId,
      donor_id: donorId,
      status: "interested",
      source: "self",
      bags: 1,
    })
    .select("*")
    .single();
  return { data: data as DonationOffer | null, error };
}

/** Direct “I donated” without interest step (when I-can-donate is off) */
export async function claimDonatedDirect(requestId: string, donorId: string, bags = 1) {
  const payload = {
    request_id: requestId,
    donor_id: donorId,
    status: "donated_claimed" as const,
    source: "self" as const,
    bags: Math.max(1, bags),
    donation_date: new Date().toISOString().slice(0, 10),
  };
  const { data: existing } = await supabase
    .from("request_donation_offers")
    .select("id, status")
    .eq("request_id", requestId)
    .eq("donor_id", donorId)
    .maybeSingle();

  if (existing?.id) {
    if (existing.status === "confirmed") {
      return { data: null, error: { message: "Already confirmed" } };
    }
    const { data, error } = await supabase
      .from("request_donation_offers")
      .update({
        status: "donated_claimed",
        bags: payload.bags,
        donation_date: payload.donation_date,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    return { data: data as DonationOffer | null, error };
  }

  const { data, error } = await supabase
    .from("request_donation_offers")
    .insert(payload)
    .select("*")
    .single();
  return { data: data as DonationOffer | null, error };
}

export async function claimDonated(offerId: string, bags = 1) {
  const { data, error } = await supabase
    .from("request_donation_offers")
    .update({
      status: "donated_claimed",
      bags: Math.max(1, bags),
      donation_date: new Date().toISOString().slice(0, 10),
    })
    .eq("id", offerId)
    .select("*")
    .single();
  return { data: data as DonationOffer | null, error };
}

export async function cancelOwnOffer(offerId: string) {
  const { data, error } = await supabase
    .from("request_donation_offers")
    .update({ status: "cancelled" })
    .eq("id", offerId)
    .select("*")
    .single();
  return { data: data as DonationOffer | null, error };
}

async function insertConfirmedDonation(params: {
  requestId: string;
  donorId: string;
  recipientId: string;
  bags: number;
  notes?: string | null;
}) {
  const { data, error } = await supabase
    .from("donations")
    .insert({
      request_id: params.requestId,
      donor_id: params.donorId,
      recipient_id: params.recipientId,
      bags: Math.max(1, params.bags),
      confirmed: true,
      donation_date: new Date().toISOString().slice(0, 10),
      notes: params.notes ?? null,
    })
    .select("id")
    .single();
  return { data, error };
}

export async function confirmOffer(params: {
  offer: DonationOffer;
  recipientId: string;
  bags?: number;
}) {
  const bags = Math.max(1, params.bags ?? params.offer.bags ?? 1);
  const { data: donation, error: dErr } = await insertConfirmedDonation({
    requestId: params.offer.request_id,
    donorId: params.offer.donor_id,
    recipientId: params.recipientId,
    bags,
  });
  if (dErr) return { error: dErr };

  const { data, error } = await supabase
    .from("request_donation_offers")
    .update({
      status: "confirmed",
      bags,
      donation_date: new Date().toISOString().slice(0, 10),
      donation_id: donation?.id ?? null,
    })
    .eq("id", params.offer.id)
    .select("*")
    .single();
  return { data: data as DonationOffer | null, error };
}

export async function rejectOffer(offerId: string) {
  const { data, error } = await supabase
    .from("request_donation_offers")
    .update({ status: "rejected" })
    .eq("id", offerId)
    .select("*")
    .single();
  return { data: data as DonationOffer | null, error };
}

/** Owner assigns a donor — immediately counted as donated */
export async function assignDonor(params: {
  requestId: string;
  donorId: string;
  requesterId: string;
  bags?: number;
  existingOfferId?: string | null;
}) {
  const bags = Math.max(1, params.bags ?? 1);
  const { data: donation, error: dErr } = await insertConfirmedDonation({
    requestId: params.requestId,
    donorId: params.donorId,
    recipientId: params.requesterId,
    bags,
    notes: "Assigned by post owner",
  });
  if (dErr) return { error: dErr };

  if (params.existingOfferId) {
    const { data, error } = await supabase
      .from("request_donation_offers")
      .update({
        status: "confirmed",
        source: "assigned",
        bags,
        assigned_by: params.requesterId,
        donation_date: new Date().toISOString().slice(0, 10),
        donation_id: donation?.id ?? null,
      })
      .eq("id", params.existingOfferId)
      .select("*")
      .single();
    return { data: data as DonationOffer | null, error };
  }

  const { data, error } = await supabase
    .from("request_donation_offers")
    .upsert(
      {
        request_id: params.requestId,
        donor_id: params.donorId,
        status: "confirmed",
        source: "assigned",
        bags,
        assigned_by: params.requesterId,
        donation_date: new Date().toISOString().slice(0, 10),
        donation_id: donation?.id ?? null,
      },
      { onConflict: "request_id,donor_id" },
    )
    .select("*")
    .single();
  return { data: data as DonationOffer | null, error };
}

export async function searchProfiles(query: string, limit = 8) {
  const q = query.trim();
  if (q.length < 2) return [] as Array<{ id: string; full_name: string | null; avatar_url: string | null; phone: string | null; blood_group: string | null }>;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, phone, blood_group")
    .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function openDonationCompletion(requestId: string) {
  return supabase
    .from("blood_requests")
    .update({ donation_completion_open: true })
    .eq("id", requestId);
}

export async function fulfillRequest(requestId: string) {
  return supabase
    .from("blood_requests")
    .update({ status: "fulfilled", donation_completion_open: false })
    .eq("id", requestId);
}
