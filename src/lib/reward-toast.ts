import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatRewardToast } from "@/lib/rewards";

/** After a known earn action, toast if a matching ledger row was just written. */
export async function toastRecentReward(
  userId: string | null | undefined,
  action: string,
  lang: "bn" | "en",
) {
  if (!userId) return;
  try {
    const { data } = await supabase
      .from("reward_ledger")
      .select("points, action, created_at")
      .eq("user_id", userId)
      .eq("action", action)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return;
    const at = new Date((data as { created_at: string }).created_at).getTime();
    if (Number.isNaN(at) || Date.now() - at > 20_000) return;
    const pts = Number((data as { points: number }).points) || 0;
    if (pts === 0) return;
    toast.success(formatRewardToast(pts, lang, action));
  } catch {
    /* schema not migrated yet */
  }
}
