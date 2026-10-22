import { useEffect, useState } from "react";
import {
  DEFAULT_PROFILE_VAULT_SETTINGS,
  fetchProfileVaultSettings,
  fillVaultText,
  vaultVisibleFor,
  type ProfileVaultSettings,
  type VaultTextStats,
} from "@/lib/profile-vault-settings";
import { fetchProfileVaultNetwork, orbitSlot, type VaultNetwork } from "@/lib/profile-vault-network";

export function ProfileMemoryVault({
  userId,
  avatarUrl,
  name,
  bloodGroup,
  donations,
  lives,
  lang,
  isOwnProfile,
}: {
  userId: string;
  avatarUrl?: string | null;
  name?: string | null;
  bloodGroup?: string | null;
  donations?: number | null;
  lives?: number | null;
  lang: "bn" | "en";
  isOwnProfile?: boolean;
}) {
  const [cfg, setCfg] = useState<ProfileVaultSettings | null>(null);
  const [net, setNet] = useState<VaultNetwork | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProfileVaultSettings()
      .then((next) => {
        if (!cancelled) setCfg(next);
      })
      .catch(() => {
        if (!cancelled) setCfg(DEFAULT_PROFILE_VAULT_SETTINGS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = cfg ? vaultVisibleFor(cfg, !!isOwnProfile) : false;

  useEffect(() => {
    if (!cfg || !visible) {
      setNet(null);
      return;
    }
    let cancelled = false;
    void fetchProfileVaultNetwork({
      userId,
      name: name ?? null,
      avatarUrl: avatarUrl ?? null,
      bloodGroup: bloodGroup ?? null,
      donations: donations ?? null,
      lives: lives ?? null,
      settings: cfg,
      lang,
    }).then((next) => {
      if (!cancelled) setNet(next);
    });
    return () => {
      cancelled = true;
    };
  }, [cfg, visible, userId, name, avatarUrl, bloodGroup, donations, lives, lang]);

  if (!cfg || !visible || !net) return null;

  const stats: VaultTextStats = {
    name: name || (lang === "bn" ? "প্রোফাইল" : "Profile"),
    photos: net.photos,
    posts: net.posts,
    requests: net.requests,
    people: net.people,
    donations: donations ?? 0,
    lives: lives ?? 0,
    blood: bloodGroup || "—",
  };
  const badge = fillVaultText(lang === "bn" ? cfg.badge_bn : cfg.badge_en, stats);
  const title = fillVaultText(lang === "bn" ? cfg.title_bn : cfg.title_en, stats);
  const subtitle = fillVaultText(lang === "bn" ? cfg.subtitle_bn : cfg.subtitle_en, stats);

  return (
    <section
      className="mx-4 mb-5 overflow-hidden rounded-3xl border text-white shadow-lg"
      style={{
        borderColor: `${net.glow}55`,
        background: "#071018",
        boxShadow: `0 0 32px ${net.glow}22`,
      }}
    >
      <div className="relative h-[340px] sm:h-[380px]">
        {cfg.show_circuit && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-70"
            style={{
              backgroundImage: `linear-gradient(${net.glow}33 1px, transparent 1px), linear-gradient(90deg, ${net.glow}33 1px, transparent 1px)`,
              backgroundSize: "28px 28px",
              maskImage: "linear-gradient(to top, black, transparent)",
            }}
          />
        )}
        {cfg.show_waveform && (
          <svg
            className="pointer-events-none absolute left-0 right-0 top-[46%] h-10 w-full"
            viewBox="0 0 400 40"
            fill="none"
            aria-hidden
            style={{ color: net.glow }}
          >
            <path d={net.wave} stroke="currentColor" strokeWidth="1.4" />
          </svg>
        )}

        <div className="absolute left-1/2 top-6 h-[250px] w-[168px] -translate-x-1/2 sm:h-[270px] sm:w-[180px]">
          <div
            className="absolute -top-2 left-1/2 h-5 w-[108%] -translate-x-1/2 rounded-full border bg-gradient-to-b from-white/50 to-slate-500/40"
            style={{ borderColor: `${net.glow}66`, boxShadow: `0 0 24px ${net.glow}73` }}
          />
          <div
            className="absolute inset-x-2 top-2 bottom-6 overflow-hidden rounded-b-[80px] rounded-t-[70px] border bg-cyan-300/5"
            style={{ borderColor: `${net.glow}55`, boxShadow: `inset 0 0 40px ${net.glow}40, 0 0 40px ${net.glow}2e` }}
          >
            <div className="absolute inset-x-4 top-2 h-8 rounded-full bg-white/20 blur-md" />
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden>
              {net.nodes.map((node, i) => {
                const slot = orbitSlot(i, net.nodes.length, userId);
                const x = Number.parseFloat(slot.left);
                const y = Number.parseFloat(slot.top);
                return (
                  <line
                    key={node.id}
                    x1="50"
                    y1="46"
                    x2={x}
                    y2={y}
                    stroke={net.glow}
                    strokeOpacity="0.45"
                    strokeWidth="0.6"
                  />
                );
              })}
            </svg>
            <div className="absolute left-1/2 top-[46%] z-10 h-12 w-12 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-2 border-white/80 shadow-lg sm:h-14 sm:w-14">
              {cfg.use_avatar && avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center bg-slate-800 text-sm font-bold" style={{ color: net.glow }}>
                  {(name || "S").slice(0, 1)}
                </div>
              )}
            </div>
            {net.nodes.map((node, i) => {
              const slot = orbitSlot(i, net.nodes.length, userId);
              return (
                <div
                  key={node.id}
                  className={`absolute z-20 h-12 w-11 overflow-hidden rounded-md border border-white/70 bg-slate-900/80 shadow-lg sm:h-14 sm:w-12 ${cfg.animate ? "profile-vault-card" : ""}`}
                  style={{
                    top: slot.top,
                    left: slot.left,
                    transform: `translate(-50%, -50%) rotate(${slot.rot}deg)`,
                    animationDelay: slot.delay,
                  }}
                >
                  {node.image ? (
                    <img src={node.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="grid h-full w-full place-items-center px-1 text-center text-[9px] font-bold leading-tight text-cyan-50">
                      {node.label}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div
            className="absolute -bottom-1 left-1/2 h-8 w-[120%] -translate-x-1/2 rounded-full border-2"
            style={{ borderColor: `${net.glow}88`, boxShadow: `0 0 28px ${net.glow}8c` }}
          />
          <p className="absolute -bottom-7 left-1/2 w-max max-w-[220px] -translate-x-1/2 truncate text-[10px] font-semibold tracking-[0.18em] text-cyan-100/80">
            {badge}
          </p>
        </div>
      </div>
      <div className="px-4 pb-4 pt-2 text-center">
        <p className="text-sm font-bold tracking-wide">{title}</p>
        <p className="mt-1 text-[11px] text-cyan-100/70">{subtitle}</p>
      </div>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .profile-vault-card { animation: profile-vault-float 5.5s ease-in-out infinite; }
        }
        @keyframes profile-vault-float {
          0%, 100% { translate: 0 0; }
          50% { translate: 0 -8px; }
        }
      `}</style>
    </section>
  );
}
