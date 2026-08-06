/** Extract a YouTube video id from watch / share / embed / shorts / bare id. */
export function parseYoutubeId(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const v = u.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      const embedIdx = parts.findIndex((p) => p === "embed" || p === "shorts" || p === "live" || p === "v");
      if (embedIdx >= 0 && parts[embedIdx + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[embedIdx + 1])) {
        return parts[embedIdx + 1];
      }
    }
  } catch {
    /* ignore */
  }
  const loose = raw.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  return loose?.[1] ?? null;
}

export function youtubePosterUrl(videoId: string, quality: "max" | "hq" = "hq"): string {
  // hqdefault is reliably available; maxresdefault 404s for some videos
  return quality === "max"
    ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
    : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function youtubeEmbedSrc(videoId: string, opts: { autoplay?: boolean } = {}): string {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    enablejsapi: "0",
  });
  if (opts.autoplay) {
    params.set("autoplay", "1");
    params.set("mute", "0");
  }
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}


