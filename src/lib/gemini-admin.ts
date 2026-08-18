import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_GEMINI_SETTINGS, GEMINI_MODEL_CATALOG_SEED } from "@/lib/gemini-shared";
import {
  DEFAULT_GEMINI_FEATURES,
  DEFAULT_GEMINI_UI,
  DEFAULT_GEMINI_FOLLOWUP,
  normalizeGeminiSettingsExtended,
  packGeminiSettingsForDb,
  type GeminiSettingsExtended,
} from "@/lib/gemini-ai-config";

async function loadRotate() {
  return import("@/lib/gemini-rotate.server");
}

export type GeminiKeyPublic = {
  id: string;
  name: string;
  masked: string;
  status: "active" | "quota" | "error" | "disabled";
  last_used_at: string | null;
  error_count: number;
  last_error: string | null;
  sort_order: number;
  is_active: boolean;
};

export type GeminiModelOption = { slug: string; label: string; is_active: boolean; sort_order: number };

function maskKey(key: string) {
  const k = key.trim();
  if (k.length < 10) return "••••";
  return `${k.slice(0, 2)}..${k.slice(2, 6)}...${k.slice(-4)}`;
}

async function assertAdmin(userId: string) {
  const { adminClient } = await loadRotate();
  const sb = adminClient();
  const { data, error } = await sb.rpc("is_admin_staff", { _uid: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Not allowed");
}

async function ensureModelCatalog(sb: SupabaseClient) {
  const { data, error } = await sb.from("gemini_model_catalog").select("slug");
  if (error) throw new Error(error.message);
  const have = new Set(((data ?? []) as { slug: string }[]).map((r) => r.slug));
  const missing = GEMINI_MODEL_CATALOG_SEED.filter((m) => !have.has(m.slug));
  if (missing.length) {
    const { error: ins } = await sb.from("gemini_model_catalog").insert(missing as never);
    if (ins) throw new Error(ins.message);
  }
  const dead = GEMINI_MODEL_CATALOG_SEED.filter((m) => !m.is_active).map((m) => m.slug);
  if (dead.length) {
    await sb.from("gemini_model_catalog").update({ is_active: false } as never).in("slug", dead);
  }
  await sb
    .from("gemini_model_catalog")
    .update({ label: "Gemini 3.6 Flash (recommended)", is_active: true, sort_order: 10 } as never)
    .eq("slug", "gemini-3.6-flash");
}

export const fetchGeminiAdminState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { adminClient, fetchSettingsRaw } = await loadRotate();
    const sb = adminClient();
    await ensureModelCatalog(sb);
    const [settingsRaw, keys, models] = await Promise.all([
      fetchSettingsRaw(sb),
      sb
        .from("gemini_api_keys")
        .select("id, name, api_key, status, last_used_at, error_count, last_error, sort_order, is_active")
        .order("sort_order")
        .order("created_at"),
      sb.from("gemini_model_catalog").select("slug, label, is_active, sort_order").order("sort_order"),
    ]);
    if (keys.error) throw new Error(keys.error.message);
    if (models.error) throw new Error(models.error.message);
    const list: GeminiKeyPublic[] = ((keys.data ?? []) as { id: string; name: string; api_key: string; status: GeminiKeyPublic["status"]; last_used_at: string | null; error_count: number; last_error: string | null; sort_order: number; is_active: boolean }[]).map((k) => ({
      id: k.id,
      name: k.name,
      masked: maskKey(k.api_key),
      status: k.status,
      last_used_at: k.last_used_at,
      error_count: k.error_count,
      last_error: k.last_error,
      sort_order: k.sort_order,
      is_active: k.is_active,
    }));
    const settings = normalizeGeminiSettingsExtended(settingsRaw);
    return {
      settings,
      keys: list,
      models: (models.data ?? []) as GeminiModelOption[],
    };
  });

export const saveGeminiSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: GeminiSettingsExtended) => normalizeGeminiSettingsExtended(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { adminClient } = await loadRotate();
    const sb = adminClient();
    const packed = packGeminiSettingsForDb(data);
    const { error } = await sb.from("app_settings").update({ gemini_settings: packed } as never).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const upsertGeminiKeyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id?: string; name: string; api_key?: string; is_active?: boolean }) => {
    const name = String(data?.name ?? "").trim();
    if (!name) throw new Error("Name required");
    return {
      id: data.id ? String(data.id) : undefined,
      name,
      api_key: data.api_key?.trim() || undefined,
      is_active: data.is_active !== false,
    };
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { adminClient } = await loadRotate();
    const sb = adminClient();
    if (data.id) {
      const patch: Record<string, unknown> = { name: data.name, is_active: data.is_active, updated_at: new Date().toISOString() };
      if (data.api_key) {
        patch.api_key = data.api_key;
        patch.status = "active";
        patch.last_error = null;
      }
      const { error } = await sb.from("gemini_api_keys").update(patch as never).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      if (!data.api_key) throw new Error("API key required");
      const { count } = await sb.from("gemini_api_keys").select("id", { count: "exact", head: true });
      const { error } = await sb.from("gemini_api_keys").insert({
        name: data.name,
        api_key: data.api_key,
        status: "active",
        is_active: true,
        sort_order: ((count ?? 0) + 1) * 10,
      } as never);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const deleteGeminiKeyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => ({ id: String(data?.id ?? "") }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    if (!data.id) throw new Error("id required");
    const { adminClient } = await loadRotate();
    const sb = adminClient();
    const { error } = await sb.from("gemini_api_keys").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const testGeminiKeyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id?: string }) => ({ id: data?.id ? String(data.id) : undefined }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { adminClient, fetchSettingsRaw, geminiPing, markKey } = await loadRotate();
    const sb = adminClient();
    const settings = normalizeGeminiSettingsExtended(await fetchSettingsRaw(sb));
    let keys: { id: string; api_key: string; name?: string }[] = [];
    if (data.id) {
      const { data: one, error } = await sb.from("gemini_api_keys").select("id, api_key, name").eq("id", data.id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!one) throw new Error("Key not found");
      keys = [one as { id: string; api_key: string; name: string }];
    } else {
      const { data: all, error } = await sb
        .from("gemini_api_keys")
        .select("id, api_key, name")
        .order("sort_order")
        .order("created_at");
      if (error) throw new Error(error.message);
      keys = (all ?? []) as { id: string; api_key: string; name: string }[];
    }
    if (!keys.length) throw new Error("No keys to test");

    const results: { id: string; name?: string; ok: boolean; message: string }[] = [];
    for (const key of keys) {
      const ping = await geminiPing(key.api_key, settings.primary_model);
      await markKey(sb, key.id, {
        status: ping.ok ? "active" : ping.message.toLowerCase().includes("quota") ? "quota" : "error",
        last_error: ping.ok ? null : ping.message,
        bumpError: !ping.ok,
      });
      results.push({ id: key.id, name: "name" in key ? String((key as { name?: string }).name ?? "") : undefined, ok: ping.ok, message: ping.message });
    }
    return { results };
  });

export const upsertGeminiModelFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { slug: string; label: string; is_active?: boolean }) => {
    const slug = String(data?.slug ?? "").trim();
    const label = String(data?.label ?? "").trim();
    if (!slug || !label) throw new Error("slug and label required");
    return { slug, label, is_active: data.is_active !== false };
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { adminClient } = await loadRotate();
    const sb = adminClient();
    const { data: existing } = await sb.from("gemini_model_catalog").select("slug").eq("slug", data.slug).maybeSingle();
    if (existing) {
      const { error } = await sb
        .from("gemini_model_catalog")
        .update({ label: data.label, is_active: data.is_active } as never)
        .eq("slug", data.slug);
      if (error) throw new Error(error.message);
    } else {
      const { count } = await sb.from("gemini_model_catalog").select("slug", { count: "exact", head: true });
      const { error } = await sb.from("gemini_model_catalog").insert({
        slug: data.slug,
        label: data.label,
        is_active: data.is_active,
        sort_order: ((count ?? 0) + 1) * 10,
      } as never);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

export { DEFAULT_GEMINI_SETTINGS, DEFAULT_GEMINI_FEATURES, DEFAULT_GEMINI_UI, DEFAULT_GEMINI_FOLLOWUP };
export type { GeminiSettingsExtended };
