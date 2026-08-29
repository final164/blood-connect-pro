import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = {
  action?: "claim" | "admin_link";
  doctor_id?: string;
  user_id?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = (await req.json()) as Body;
    const doctorId = body.doctor_id;
    if (!doctorId) return json({ error: "doctor_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: doc, error: dErr } = await admin
      .from("care_doctors")
      .select("id, user_id, full_name, is_active")
      .eq("id", doctorId)
      .maybeSingle();
    if (dErr || !doc) return json({ error: "Doctor not found" }, 404);

    if (body.action === "admin_link") {
      const { data: staff } = await admin.rpc("is_care_staff", { _uid: user.id });
      if (!staff) return json({ error: "Not allowed" }, 403);
      const target = body.user_id;
      if (!target) return json({ error: "user_id required" }, 400);

      await admin.from("care_doctors").update({ user_id: null }).eq("user_id", target).neq("id", doctorId);
      const { data: updated, error } = await admin
        .from("care_doctors")
        .update({ user_id: target })
        .eq("id", doctorId)
        .select("id, user_id, full_name")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, doctor: updated });
    }

    // claim: link current user to unlinked video doctor
    const { data: prof } = await admin
      .from("tele_doctor_profiles")
      .select("video_enabled")
      .eq("doctor_id", doctorId)
      .maybeSingle();
    if (!prof?.video_enabled) return json({ error: "Doctor is not enabled for video consult" }, 400);

    if (doc.user_id && doc.user_id !== user.id) {
      return json({ error: "Doctor already linked to another account" }, 409);
    }

    await admin.from("care_doctors").update({ user_id: null }).eq("user_id", user.id).neq("id", doctorId);
    const { data: updated, error } = await admin
      .from("care_doctors")
      .update({ user_id: user.id })
      .eq("id", doctorId)
      .select("id, user_id, full_name")
      .single();
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, doctor: updated });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
