import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { JWT } from "npm:google-auth-library@9";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type DriveSettings = {
  enabled?: boolean;
  folder_id?: string;
  folder_requests?: string;
  folder_avatars?: string;
  folder_media?: string;
  make_public?: boolean;
};

type Purpose = "request" | "avatar" | "media";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function pickFolder(settings: DriveSettings, purpose: Purpose): string {
  if (purpose === "request" && settings.folder_requests?.trim()) return settings.folder_requests.trim();
  if (purpose === "avatar" && settings.folder_avatars?.trim()) return settings.folder_avatars.trim();
  if (purpose === "media" && settings.folder_media?.trim()) return settings.folder_media.trim();
  return (settings.folder_id ?? "").trim();
}

function parseSaJson(raw: string): Record<string, string> {
  const parsed = JSON.parse(raw) as Record<string, string>;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Service account JSON missing client_email or private_key");
  }
  return parsed;
}

async function loadServiceAccount(admin: SupabaseClient): Promise<Record<string, string>> {
  const { data } = await admin
    .from("google_drive_secrets")
    .select("service_account_json, client_email")
    .eq("id", 1)
    .maybeSingle();
  const fromDb = (data?.service_account_json as string | undefined)?.trim();
  if (fromDb) return parseSaJson(fromDb);

  const envRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")?.trim();
  if (envRaw) return parseSaJson(envRaw);

  throw new Error(
    "Service account not configured — paste JSON in Admin → Settings → Google Drive",
  );
}

async function getAccessToken(sa: Record<string, string>) {
  const client = new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/drive.file",
    ],
  });
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("Failed to get Google access token");
  return token.token;
}

async function requireAdmin(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin only");
}

async function loadSettings(admin: SupabaseClient): Promise<DriveSettings> {
  const { data: row } = await admin
    .from("app_settings")
    .select("google_drive_settings")
    .eq("id", 1)
    .maybeSingle();
  return (row?.google_drive_settings ?? {}) as DriveSettings;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (req.method === "POST") {
      const ct = req.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const body = await req.json();
        const action = String(body?.action ?? "");

        if (action === "health") {
          let saEmail = "";
          let hasSa = false;
          try {
            const sa = await loadServiceAccount(admin);
            saEmail = sa.client_email ?? "";
            hasSa = true;
          } catch {
            /* ignore */
          }
          const settings = await loadSettings(admin);
          return json({
            ok: true,
            enabled: settings.enabled === true,
            has_service_account: hasSa,
            service_account_email: saEmail,
            source: hasSa ? "admin_or_env" : "none",
            folder_configured: !!(
              settings.folder_id ||
              settings.folder_media ||
              settings.folder_requests ||
              settings.folder_avatars
            ),
          });
        }

        if (action === "save_secret") {
          try {
            await requireAdmin(admin, user.id);
          } catch (e) {
            return json({ error: e instanceof Error ? e.message : "Admin only" }, 403);
          }
          const raw = String(body?.service_account_json ?? "").trim();
          if (!raw) return json({ error: "service_account_json is required" }, 400);
          let sa: Record<string, string>;
          try {
            sa = parseSaJson(raw);
          } catch (e) {
            return json({ error: e instanceof Error ? e.message : "Invalid JSON" }, 400);
          }
          // Normalize private_key newlines if pasted with \\n
          if (sa.private_key.includes("\\n")) {
            sa.private_key = sa.private_key.replace(/\\n/g, "\n");
          }
          const normalized = JSON.stringify(sa);
          const { error } = await admin.from("google_drive_secrets").upsert({
            id: 1,
            service_account_json: normalized,
            client_email: sa.client_email,
            updated_at: new Date().toISOString(),
          });
          if (error) return json({ error: error.message }, 500);
          return json({ ok: true, client_email: sa.client_email });
        }

        if (action === "clear_secret") {
          try {
            await requireAdmin(admin, user.id);
          } catch (e) {
            return json({ error: e instanceof Error ? e.message : "Admin only" }, 403);
          }
          const { error } = await admin.from("google_drive_secrets").upsert({
            id: 1,
            service_account_json: "",
            client_email: "",
            updated_at: new Date().toISOString(),
          });
          if (error) return json({ error: error.message }, 500);
          return json({ ok: true });
        }

        if (action === "test") {
          try {
            await requireAdmin(admin, user.id);
          } catch (e) {
            return json({ error: e instanceof Error ? e.message : "Admin only" }, 403);
          }
          const settings = await loadSettings(admin);
          const folderId = pickFolder(settings, "media") || settings.folder_id?.trim() || "";
          try {
            const sa = await loadServiceAccount(admin);
            const accessToken = await getAccessToken(sa);
            if (!folderId) {
              return json({
                ok: true,
                token_ok: true,
                folder_ok: false,
                client_email: sa.client_email,
                message: "Token OK — set a folder ID and share it with the service account",
              });
            }
            const folderRes = await fetch(
              `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType`,
              { headers: { Authorization: `Bearer ${accessToken}` } },
            );
            if (!folderRes.ok) {
              const errText = await folderRes.text();
              return json({
                ok: false,
                token_ok: true,
                folder_ok: false,
                client_email: sa.client_email,
                error: `Cannot access folder. Share it with ${sa.client_email} as Editor. (${errText.slice(0, 200)})`,
              });
            }
            const folder = (await folderRes.json()) as { id?: string; name?: string };
            return json({
              ok: true,
              token_ok: true,
              folder_ok: true,
              client_email: sa.client_email,
              folder_id: folder.id,
              folder_name: folder.name,
              message: `Connected — folder "${folder.name ?? folderId}"`,
            });
          } catch (e) {
            return json({
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            }, 400);
          }
        }

        return json({ error: "Unknown JSON action" }, 400);
      }
    }

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    // Multipart image upload
    const settings = await loadSettings(admin);
    if (settings.enabled !== true) {
      return json({ error: "Google Drive uploads are disabled in admin settings" }, 503);
    }

    const form = await req.formData();
    const file = form.get("file");
    const purposeRaw = String(form.get("purpose") ?? "media");
    const purpose: Purpose =
      purposeRaw === "request" || purposeRaw === "avatar" || purposeRaw === "media"
        ? purposeRaw
        : "media";

    if (!(file instanceof File)) return json({ error: "file is required" }, 400);
    if (!file.type.startsWith("image/")) return json({ error: "Only image files allowed" }, 400);
    if (file.size > 8 * 1024 * 1024) return json({ error: "Max 8 MB" }, 400);

    const folderId = pickFolder(settings, purpose);
    if (!folderId) return json({ error: "Drive folder ID is not configured" }, 400);

    const sa = await loadServiceAccount(admin);
    const accessToken = await getAccessToken(sa);

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const safeName = `${purpose}-${user.id.slice(0, 8)}-${Date.now()}.${ext}`;
    const metadata = {
      name: safeName,
      parents: [folderId],
    };

    const boundary = "bloodlink_" + crypto.randomUUID().replace(/-/g, "");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const metaPart =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n`;
    const fileHeader =
      `--${boundary}\r\nContent-Type: ${file.type || "image/jpeg"}\r\n\r\n`;
    const closing = `\r\n--${boundary}--\r\n`;

    const encoder = new TextEncoder();
    const metaBytes = encoder.encode(metaPart);
    const headerBytes = encoder.encode(fileHeader);
    const closeBytes = encoder.encode(closing);
    const body = new Uint8Array(metaBytes.length + headerBytes.length + bytes.length + closeBytes.length);
    body.set(metaBytes, 0);
    body.set(headerBytes, metaBytes.length);
    body.set(bytes, metaBytes.length + headerBytes.length);
    body.set(closeBytes, metaBytes.length + headerBytes.length + bytes.length);

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return json({ error: `Drive upload failed: ${errText.slice(0, 400)}` }, 502);
    }

    const uploaded = (await uploadRes.json()) as { id?: string };
    if (!uploaded.id) return json({ error: "Drive upload returned no file id" }, 502);

    if (settings.make_public !== false) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${uploaded.id}/permissions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      });
    }

    const viewUrl = `https://drive.google.com/uc?export=view&id=${uploaded.id}`;
    const thumbUrl = `https://drive.google.com/thumbnail?id=${uploaded.id}&sz=w1200`;

    return json({
      ok: true,
      file_id: uploaded.id,
      url: thumbUrl,
      view_url: viewUrl,
      drive_url: `https://drive.google.com/file/d/${uploaded.id}/view`,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
