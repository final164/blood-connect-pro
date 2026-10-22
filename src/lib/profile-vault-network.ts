import { supabase } from "@/integrations/supabase/client";
import type { ProfileVaultSettings } from "@/lib/profile-vault-settings";

export type VaultNode = {
  id: string;
  kind: "photo" | "request" | "person" | "stat";
  image: string | null;
  label: string;
};

export type VaultNetwork = {
  nodes: VaultNode[];
  photos: number;
  posts: number;
  requests: number;
  people: number;
  wave: string;
  glow: string;
};

const GLOW: Record<string, string> = {
  "O+": "#22d3ee",
  "O-": "#67e8f9",
  "A+": "#fb7185",
  "A-": "#fda4af",
  "B+": "#fbbf24",
  "B-": "#fcd34d",
  "AB+": "#a78bfa",
  "AB-": "#c4b5fd",
};

function hashSeed(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function vaultWavePath(seed: string) {
  let h = hashSeed(seed);
  const parts = ["M0 20"];
  let x = 0;
  while (x < 400) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    x += 16 + (h % 14);
    if (h % 5 === 0) {
      const peak = 4 + (h % 8);
      parts.push(`L${x} 20`, `L${x + 7} ${peak}`, `L${x + 14} ${36 - (h % 6)}`, `L${x + 22} 20`);
      x += 22;
    } else {
      parts.push(`L${Math.min(x, 400)} 20`);
    }
  }
  return parts.join(" ");
}

export function orbitSlot(index: number, total: number, seed: string) {
  const turn = (hashSeed(seed) % 360) * (Math.PI / 180);
  const angle = turn + (index / Math.max(total, 1)) * Math.PI * 2;
  const ring = total <= 3 ? 30 : 26 + (index % 2) * 12;
  const left = 50 + Math.cos(angle) * ring;
  const top = 46 + Math.sin(angle) * ring * 0.78;
  const rot = ((hashSeed(seed + index) % 18) - 9);
  return {
    left: `${Math.min(78, Math.max(8, left))}%`,
    top: `${Math.min(74, Math.max(8, top))}%`,
    rot,
    delay: `${(index % 5) * 0.35}s`,
  };
}

async function safe<T>(query: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T | null> {
  try {
    const { data, error } = await query;
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function fetchProfileVaultNetwork(input: {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  bloodGroup: string | null;
  donations: number | null;
  lives: number | null;
  settings: ProfileVaultSettings;
  lang: "bn" | "en";
}): Promise<VaultNetwork> {
  const { userId, settings, lang } = input;
  const bn = lang === "bn";
  const limit = settings.max_photos;
  const nodes: VaultNode[] = [];

  const [postRows, requestRows, followRows] = await Promise.all([
    settings.use_post_photos
      ? safe(
          supabase
            .from("posts")
            .select("id, image_url, content")
            .eq("author_id", userId)
            .order("created_at", { ascending: false })
            .limit(limit),
        )
      : Promise.resolve(null),
    settings.use_requests
      ? safe(
          supabase
            .from("blood_requests")
            .select("id, image_url, blood_group, patient_name")
            .eq("requester_id", userId)
            .order("created_at", { ascending: false })
            .limit(limit),
        )
      : Promise.resolve(null),
    settings.use_people
      ? safe(
          supabase.from("follows").select("followee_id").eq("follower_id", userId).limit(limit),
        )
      : Promise.resolve(null),
  ]);

  const posts = (postRows ?? []) as { id: string; image_url: string | null; content: string | null }[];
  const requests = (requestRows ?? []) as {
    id: string;
    image_url: string | null;
    blood_group: string | null;
    patient_name: string | null;
  }[];
  const followIds = ((followRows ?? []) as { followee_id: string }[]).map((row) => row.followee_id).filter(Boolean);

  let people: { id: string; full_name: string | null; avatar_url: string | null; blood_group: string | null }[] = [];
  if (followIds.length) {
    const peopleRows = await safe(
      supabase.from("profiles").select("id, full_name, avatar_url, blood_group").in("id", followIds),
    );
    people = (peopleRows ?? []) as typeof people;
  }

  for (const post of posts) {
    if (nodes.length >= limit) break;
    if (post.image_url) {
      nodes.push({ id: `post-${post.id}`, kind: "photo", image: post.image_url, label: bn ? "পোস্ট" : "Post" });
    } else if (post.content?.trim()) {
      nodes.push({
        id: `post-${post.id}`,
        kind: "photo",
        image: null,
        label: post.content.trim().slice(0, 42),
      });
    }
  }
  const photoCount = nodes.filter((node) => node.kind === "photo" && node.image).length;

  for (const request of requests) {
    if (nodes.length >= limit) break;
    nodes.push({
      id: `req-${request.id}`,
      kind: "request",
      image: request.image_url,
      label: request.blood_group || request.patient_name || (bn ? "রিকোয়েস্ট" : "Request"),
    });
  }

  for (const person of people) {
    if (nodes.length >= limit) break;
    nodes.push({
      id: `person-${person.id}`,
      kind: "person",
      image: person.avatar_url,
      label: person.full_name || person.blood_group || (bn ? "সংযোগ" : "Link"),
    });
  }

  if (settings.use_stats) {
    const stats: VaultNode[] = [
      {
        id: "stat-blood",
        kind: "stat",
        image: null,
        label: input.bloodGroup || "—",
      },
      {
        id: "stat-donations",
        kind: "stat",
        image: null,
        label: `${input.donations ?? 0}`,
      },
      {
        id: "stat-lives",
        kind: "stat",
        image: null,
        label: `${input.lives ?? 0}`,
      },
    ];
    for (const stat of stats) {
      if (nodes.length >= limit) break;
      if (stat.id === "stat-blood" && !input.bloodGroup) continue;
      nodes.push(stat);
    }
  }

  if (settings.use_avatar && input.avatarUrl && nodes.length < limit && !nodes.some((node) => node.image === input.avatarUrl)) {
    nodes.unshift({
      id: "avatar",
      kind: "photo",
      image: input.avatarUrl,
      label: input.name || (bn ? "প্রোফাইল" : "Profile"),
    });
  }

  return {
    nodes: nodes.slice(0, limit),
    photos: photoCount,
    posts: posts.length,
    requests: requests.length,
    people: people.length,
    wave: vaultWavePath(userId),
    glow: GLOW[input.bloodGroup ?? ""] ?? "#22d3ee",
  };
}
