import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { District } from "@/lib/api";

type ProfilePrefill = {
  full_name?: string | null;
  phone?: string | null;
  area?: string | null;
  city?: string | null;
  district_id?: string | null;
};

/** Prefill booking guest fields from the signed-in user's profile (only empty fields). */
export function useAmbulanceProfilePrefill(opts: {
  userId?: string | null;
  setGuestName: (v: string | ((prev: string) => string)) => void;
  setGuestPhone: (v: string | ((prev: string) => string)) => void;
  setPickupAddress: (v: string | ((prev: string) => string)) => void;
  setPickupDistrict: (v: District | null | ((prev: District | null) => District | null)) => void;
}) {
  const { userId, setGuestName, setGuestPhone, setPickupAddress, setPickupDistrict } = opts;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, area, city, district_id")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled || !data) return;
      const p = data as ProfilePrefill;

      if (p.full_name) setGuestName((prev) => prev || p.full_name || "");
      if (p.phone) setGuestPhone((prev) => prev || p.phone || "");

      const addr = [p.area, p.city].filter(Boolean).join(", ");
      if (addr) setPickupAddress((prev) => prev || addr);

      if (p.district_id) {
        const { data: dist } = await supabase
          .from("districts")
          .select("id, name_en, name_bn, division_id")
          .eq("id", p.district_id)
          .maybeSingle();
        if (!cancelled && dist) {
          setPickupDistrict((prev) => prev ?? (dist as District));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, setGuestName, setGuestPhone, setPickupAddress, setPickupDistrict]);
}
