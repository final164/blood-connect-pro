import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { PUBLIC_SUPABASE_URL } from "@/integrations/supabase/public-env";

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("Server auth is not configured — set SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function callerUserId(accessToken: string): Promise<string> {
  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Unauthorized");
  return data.user.id;
}

export const teleLinkDoctorFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      action: "claim" | "admin_link";
      doctorId: string;
      accessToken: string;
      userId?: string;
    }) => {
      const action = data?.action === "admin_link" ? "admin_link" : "claim";
      const doctorId = String(data?.doctorId ?? "").trim();
      const accessToken = String(data?.accessToken ?? "").trim();
      const userId = data?.userId ? String(data.userId).trim() : undefined;
      if (!doctorId) throw new Error("doctorId required");
      if (!accessToken) throw new Error("accessToken required");
      return { action, doctorId, accessToken, userId };
    },
  )
  .handler(async ({ data }) => {
    const admin = adminClient();
    const callerId = await callerUserId(data.accessToken);

    const { data: doc, error: dErr } = await admin
      .from("care_doctors")
      .select("id, user_id, full_name")
      .eq("id", data.doctorId)
      .maybeSingle();
    if (dErr || !doc) throw new Error("Doctor not found");

    if (data.action === "admin_link") {
      const { data: staff } = await admin.rpc("is_care_staff", { _uid: callerId });
      if (!staff) throw new Error("Not allowed");
      const target = data.userId;
      if (!target) throw new Error("userId required");

      await admin.from("care_doctors").update({ user_id: null }).eq("user_id", target).neq("id", data.doctorId);
      const { data: updated, error } = await admin
        .from("care_doctors")
        .update({ user_id: target })
        .eq("id", data.doctorId)
        .select("id, user_id, full_name")
        .single();
      if (error) throw new Error(error.message);
      return { ok: true as const, doctor: updated };
    }

    const { data: prof } = await admin
      .from("tele_doctor_profiles")
      .select("video_enabled")
      .eq("doctor_id", data.doctorId)
      .maybeSingle();
    if (!prof?.video_enabled) throw new Error("Doctor is not enabled for video consult");

    if (doc.user_id && doc.user_id !== callerId) {
      throw new Error("Doctor already linked to another account");
    }

    await admin.from("care_doctors").update({ user_id: null }).eq("user_id", callerId).neq("id", data.doctorId);
    const { data: updated, error } = await admin
      .from("care_doctors")
      .update({ user_id: callerId })
      .eq("id", data.doctorId)
      .select("id, user_id, full_name")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, doctor: updated };
  });
