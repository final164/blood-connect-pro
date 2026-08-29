import { supabase } from "@/integrations/supabase/client";

export type TelePrescription = {
  id: string;
  booking_id: string;
  doctor_id: string;
  status: "draft" | "signed";
  advice_bn: string | null;
  advice_en: string | null;
  signed_at: string | null;
};

export type TelePrescriptionItem = {
  id: string;
  prescription_id: string;
  kind: "medicine" | "test" | "advice";
  name: string;
  strength: string | null;
  dose: string | null;
  route: string | null;
  frequency: string | null;
  duration: string | null;
  notes: string | null;
  sort_order: number;
};

export async function fetchTelePrescription(bookingId: string): Promise<{
  prescription: TelePrescription | null;
  items: TelePrescriptionItem[];
}> {
  const { data: rx, error } = await supabase
    .from("tele_prescriptions")
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!rx) return { prescription: null, items: [] };
  const { data: items, error: ie } = await supabase
    .from("tele_prescription_items")
    .select("*")
    .eq("prescription_id", rx.id)
    .order("sort_order");
  if (ie) throw new Error(ie.message);
  return {
    prescription: rx as TelePrescription,
    items: (items ?? []) as TelePrescriptionItem[],
  };
}

export async function ensureTelePrescriptionDraft(bookingId: string, doctorId: string) {
  const existing = await fetchTelePrescription(bookingId);
  if (existing.prescription) return existing;

  const { data, error } = await supabase
    .from("tele_prescriptions")
    .insert({
      booking_id: bookingId,
      doctor_id: doctorId,
      status: "draft",
    } as never)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { prescription: data as TelePrescription, items: [] as TelePrescriptionItem[] };
}

export async function addTelePrescriptionItem(
  prescriptionId: string,
  item: Omit<TelePrescriptionItem, "id" | "prescription_id">,
) {
  const { data, error } = await supabase
    .from("tele_prescription_items")
    .insert({ ...item, prescription_id: prescriptionId } as never)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as TelePrescriptionItem;
}

export async function updateTelePrescriptionItem(
  id: string,
  patch: Partial<Omit<TelePrescriptionItem, "id" | "prescription_id">>,
) {
  const { error } = await supabase.from("tele_prescription_items").update(patch as never).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTelePrescriptionItem(id: string) {
  const { error } = await supabase.from("tele_prescription_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function saveTelePrescriptionAdvice(
  prescriptionId: string,
  advice: { advice_bn?: string; advice_en?: string },
) {
  const { error } = await supabase
    .from("tele_prescriptions")
    .update({ ...advice, updated_at: new Date().toISOString() } as never)
    .eq("id", prescriptionId)
    .eq("status", "draft");
  if (error) throw new Error(error.message);
}

export async function signTelePrescription(prescriptionId: string) {
  const { data, error } = await supabase.rpc("tele_sign_prescription", {
    _prescription_id: prescriptionId,
  });
  if (error) throw new Error(error.message);
  return data as TelePrescription;
}
