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

/** Paths guests may browse without a session (soft gate in AppLayout). */
export function isGuestBrowsePath(pathname: string): boolean {
  if (pathname === "/care" || pathname.startsWith("/care/")) {
    if (pathname.startsWith("/care/portal") || pathname.startsWith("/care/auth")) return false;
    if (pathname.startsWith("/care/serial") || pathname.startsWith("/care/lab-booking")) return false;
    if (pathname.startsWith("/care/desk") || pathname === "/care/lab" || pathname.startsWith("/care/lab/"))
      return false;
    return true;
  }
  if (pathname === "/ambulance" || pathname.startsWith("/ambulance/provider/")) return true;
  return false;
}

const AI_CHAT_DRAFT_KEY = "bloodlink:ai-chat-draft";

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
    const raw = sessionStorage.getItem(AI_CHAT_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { path?: string; text?: string; at?: number };
    if (parsed.path !== path || typeof parsed.text !== "string" || !parsed.text.trim()) return null;
    if (typeof parsed.at === "number" && Date.now() - parsed.at > 30 * 60 * 1000) {
      sessionStorage.removeItem(AI_CHAT_DRAFT_KEY);
      return null;
    }
    sessionStorage.removeItem(AI_CHAT_DRAFT_KEY);
    return parsed.text.trim();
  } catch {
    return null;
  }
}

export const AI_CHAT_RESUME_PATH = "/care/ai-tests";
