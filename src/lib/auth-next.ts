/** Safe same-origin path for post-login redirects (?next=). */
export function isSafeNextPath(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("://") || path.includes("\\")) return false;
  if (/[\s<>"']/.test(path)) return false;
  return path.length <= 512;
}

export function authWithNext(nextPath: string): string {
  const next = nextPath.trim() || "/home";
  if (!isSafeNextPath(next)) return "/auth";
  return `/auth?next=${encodeURIComponent(next)}`;
}

function careHubTab(search?: Record<string, unknown> | null): string {
  if (!search || typeof search !== "object") return "";
  const tab = search.tab;
  return typeof tab === "string" ? tab.trim() : "";
}

/**
 * True when this in-app href must be behind phone login
 * (landing tiles + soft gate), regardless of CMS `requires_auth` flags.
 */
export function hrefRequiresLogin(href: string): boolean {
  const raw = (href || "").trim();
  if (!raw || raw.startsWith("#") || raw.startsWith("http") || raw.startsWith("tel:") || raw.startsWith("mailto:")) {
    return false;
  }
  const [pathPart, qs = ""] = raw.split("?");
  const pathname = pathPart || "/";
  const search: Record<string, unknown> = {};
  if (qs) {
    new URLSearchParams(qs).forEach((v, k) => {
      search[k] = v;
    });
  }
  return !isGuestBrowsePath(pathname, search);
}

/** Paths guests may browse without a session (soft gate in AppLayout). */
export function isGuestBrowsePath(
  pathname: string,
  search?: Record<string, unknown> | null,
): boolean {
  // Ambulance booking always requires a real account
  if (pathname === "/ambulance" || pathname.startsWith("/ambulance/")) return false;

  if (pathname === "/care" || pathname.startsWith("/care/")) {
    if (pathname.startsWith("/care/portal") || pathname.startsWith("/care/auth")) return false;
    if (pathname.startsWith("/care/serial") || pathname.startsWith("/care/lab-booking")) return false;
    if (pathname.startsWith("/care/desk") || pathname === "/care/lab" || pathname.startsWith("/care/lab/"))
      return false;
    // Doctor profiles + booking
    if (pathname.startsWith("/care/doctor")) return false;
    // Care hub: default tab is doctors; doctors/bookings need login
    if (pathname === "/care" || pathname === "/care/") {
      const tab = careHubTab(search);
      if (!tab || tab === "doctors" || tab === "bookings") return false;
      return true;
    }
    // AI health / individual test pages remain publicly browsable
    return true;
  }
  return false;
}

const AI_CHAT_DRAFT_KEY = "muktosheba:ai-chat-draft";
const AI_CHAT_DRAFT_LEGACY_KEYS = ["bloodlink:ai-chat-draft", "Muktosheba:ai-chat-draft"];

/** Persist chat draft across login redirect (text only; path scopes restore). */
export function saveAiChatDraft(path: string, text: string) {
  if (typeof window === "undefined") return;
  const t = text.trim();
  if (!t || !isSafeNextPath(path)) return;
  try {
    sessionStorage.setItem(AI_CHAT_DRAFT_KEY, JSON.stringify({ path, text: t.slice(0, 4000), at: Date.now() }));
  } catch {
    /* private mode */
  }
}

/** Read and clear draft when returning to the matching chat path. */
export function consumeAiChatDraft(path: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    let raw = sessionStorage.getItem(AI_CHAT_DRAFT_KEY);
    let usedKey = AI_CHAT_DRAFT_KEY;
    if (!raw) {
      for (const k of AI_CHAT_DRAFT_LEGACY_KEYS) {
        raw = sessionStorage.getItem(k);
        if (raw) {
          usedKey = k;
          break;
        }
      }
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { path?: string; text?: string; at?: number };
    if (parsed.path !== path || typeof parsed.text !== "string" || !parsed.text.trim()) return null;
    if (typeof parsed.at === "number" && Date.now() - parsed.at > 30 * 60 * 1000) {
      sessionStorage.removeItem(usedKey);
      return null;
    }
    sessionStorage.removeItem(usedKey);
    for (const k of AI_CHAT_DRAFT_LEGACY_KEYS) sessionStorage.removeItem(k);
    return parsed.text.trim();
  } catch {
    return null;
  }
}

export const AI_CHAT_RESUME_PATH = "/care/ai-tests";
