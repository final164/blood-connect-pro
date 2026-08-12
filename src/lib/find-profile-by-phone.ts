import { supabase } from "@/integrations/supabase/client";

/** Normalize phone to digits for matching. */
export function phoneDigits(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

function phoneCandidates(phone: string): string[] {
  const digits = phoneDigits(phone);
  if (digits.length < 10) return [];
  const last10 = digits.slice(-10);
  const last11 = digits.length >= 11 ? digits.slice(-11) : `0${last10}`;
  return [...new Set([
    phone.trim(),
    digits,
    last10,
    last11,
    `0${last10}`,
    `88${last10}`,
    `+88${last10}`,
    `+880${last10.slice(-10)}`,
  ].filter(Boolean))];
}

/**
 * Find an app profile id by phone.
 * Returns null when no signed-up user matches (org-only donor).
 */
export async function findProfileIdByPhone(phone: string | null | undefined): Promise<string | null> {
  const raw = (phone ?? "").trim();
  if (!raw) return null;

  for (const candidate of phoneCandidates(raw)) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", candidate)
      .maybeSingle();
    if (!error && data?.id) return data.id as string;
  }

  const last10 = phoneDigits(raw).slice(-10);
  if (last10.length === 10) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .ilike("phone", `%${last10}`)
      .limit(1)
      .maybeSingle();
    if (!error && data?.id) return data.id as string;
  }

  return null;
}
