import { useState } from "react";
import { Play } from "lucide-react";
import {
  parseYoutubeId,
  youtubeEmbedSrc,
  youtubePosterUrl,
} from "@/lib/youtube";
import type { LandingHeroYoutube } from "@/lib/landing-settings";

function pick(lang: "bn" | "en", bn: string, en: string) {
  return lang === "bn" ? bn : en;
}

type Props = {
  youtube: LandingHeroYoutube;
  lang: "bn" | "en";
  /** Compact card inside hero grid */
  variant?: "hero" | "section";
};

/**
 * Privacy-friendly YouTube facade: thumbnail + play until click,
 * then nocookie iframe with autoplay — no redirect to YouTube.
 */
export function LandingYoutubePlayer({ youtube, lang, variant = "hero" }: Props) {
  const videoId = parseYoutubeId(youtube.url);
  const [playing, setPlaying] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);

  if (!youtube.enabled || !videoId) return null;

  const poster =
    youtube.poster_url?.trim() ||
    (posterFailed ? youtubePosterUrl(videoId, "hq") : youtubePosterUrl(videoId, "max"));
  const title = pick(lang, youtube.title_bn, youtube.title_en);
  const body = pick(lang, youtube.body_bn, youtube.body_en);
  const autoplay = youtube.autoplay_on_click !== false;

  const frame = (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-lg shadow-black/25 ring-1 ring-white/15">
      {playing ? (
        <iframe
          title={title || "YouTube video"}
          src={youtubeEmbedSrc(videoId, { autoplay })}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="eager"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0 block w-full cursor-pointer text-left"
          aria-label={lang === "bn" ? "ভিডিও চালু করুন" : "Play video"}
        >
          <img
            src={poster}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
            loading="lazy"
            decoding="async"
            width={1280}
            height={720}
            onError={() => {
              if (!posterFailed && !youtube.poster_url?.trim()) setPosterFailed(true);
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />
          <span className="absolute inset-0 grid place-items-center">
            <span
              className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full text-white shadow-xl shadow-black/40 ring-4 ring-white/25 transition group-hover:scale-105"
              style={{ background: "var(--landing-primary)" }}
            >
              <Play className="h-6 w-6 sm:h-7 sm:w-7 fill-current ml-0.5" />
            </span>
          </span>
          {variant === "hero" && (title || body) && (
            <span className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 text-white pointer-events-none">
              {title ? (
                <span className="block text-sm sm:text-base font-semibold leading-snug line-clamp-2">
                  {title}
                </span>
              ) : null}
              {body ? (
                <span className="mt-0.5 block text-[11px] sm:text-xs text-white/80 line-clamp-2">
                  {body}
                </span>
              ) : null}
            </span>
          )}
        </button>
      )}
    </div>
  );

  if (variant === "hero") {
    return (
      <div id="video" className="w-full max-w-lg mx-auto lg:max-w-none lg:mx-0 lg:justify-self-end">
        {frame}
      </div>
    );
  }

  return (
    <section
      id="video"
      className="landing-section mx-auto w-full max-w-5xl md:max-w-6xl px-4 sm:px-5 py-10"
    >
      {(title || body) && (
        <div className="mb-4 max-w-2xl">
          {title ? <h2 className="text-xl md:text-2xl font-bold landing-brand">{title}</h2> : null}
          {body ? (
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--landing-muted)" }}>
              {body}
            </p>
          ) : null}
        </div>
      )}
      <div className="mx-auto max-w-3xl">{frame}</div>
    </section>
  );
}
