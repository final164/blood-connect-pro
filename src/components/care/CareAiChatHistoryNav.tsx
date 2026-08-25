import { PanelLeft, Plus, Trash2, X } from "lucide-react";
import type { CareAiChatThreadSummary } from "@/lib/care-ai-chat-store";

export function CareAiChatHistoryNav({
  open,
  onOpenChange,
  threads,
  lang,
  onSelect,
  onDelete,
  onNewChat,
  variant = "app",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threads: CareAiChatThreadSummary[];
  lang: "bn" | "en";
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewChat?: () => void;
  variant?: "app" | "landing";
}) {
  const panel =
    variant === "landing"
      ? "border-black/10 bg-[#f9f9f9] text-black/90"
      : "border-border bg-background text-foreground";
  const muted = variant === "landing" ? "text-black/45" : "text-muted-foreground";
  const hover = variant === "landing" ? "hover:bg-black/5" : "hover:bg-muted";
  const activeRow = variant === "landing" ? "bg-black/8" : "bg-muted";

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className={
          variant === "landing"
            ? "landing-hero-card-btn-muted text-[11px] font-semibold px-2 py-1 rounded-lg inline-flex items-center gap-1"
            : "shrink-0 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted inline-flex items-center gap-1"
        }
        aria-label={lang === "bn" ? "চ্যাট তালিকা" : "Chat list"}
      >
        <PanelLeft className="h-3.5 w-3.5" />
        {lang === "bn" ? "চ্যাট" : "Chats"}
        {threads.length > 0 ? <span className="tabular-nums opacity-70">{threads.length}</span> : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex justify-start sm:justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
          />
          <aside
            className={`relative z-10 flex h-full w-[min(100%,17.5rem)] flex-col border-r sm:border-r-0 sm:border-l shadow-xl ${panel}`}
            role="dialog"
            aria-label={lang === "bn" ? "চ্যাট তালিকা" : "Chat list"}
          >
            <div className="flex items-center gap-2 px-2.5 py-2.5 border-b shrink-0">
              <p className="text-sm font-semibold flex-1 px-1">
                {lang === "bn" ? "চ্যাট" : "Chats"}
              </p>
              {onNewChat ? (
                <button
                  type="button"
                  onClick={() => {
                    onNewChat();
                    onOpenChange(false);
                  }}
                  className={`h-8 w-8 rounded-lg grid place-items-center ${hover}`}
                  title={lang === "bn" ? "নতুন চ্যাট" : "New chat"}
                >
                  <Plus className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className={`h-8 w-8 rounded-lg grid place-items-center ${hover}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-1.5 py-2 space-y-0.5" aria-label={lang === "bn" ? "টপিক তালিকা" : "Topics"}>
              {threads.length === 0 ? (
                <p className={`text-xs px-3 py-8 text-center ${muted}`}>
                  {lang === "bn" ? "এখনও কোনো চ্যাট নেই" : "No chats yet"}
                </p>
              ) : (
                threads.map((t) => {
                  const label = (t.topic || t.title || "").trim() || (lang === "bn" ? "চ্যাট" : "Chat");
                  return (
                    <div
                      key={t.id}
                      className={`group flex items-center gap-0.5 rounded-lg ${t.active ? activeRow : ""} ${hover}`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left px-2.5 py-2"
                        onClick={() => {
                          onSelect(t.id);
                          onOpenChange(false);
                        }}
                      >
                        <p className="text-[13px] font-medium leading-snug line-clamp-2">{label}</p>
                      </button>
                      <button
                        type="button"
                        className="shrink-0 h-7 w-7 mr-1 rounded-md grid place-items-center opacity-50 sm:opacity-0 sm:group-hover:opacity-70 hover:!opacity-100 hover:bg-destructive/10 hover:text-destructive"
                        title={lang === "bn" ? "মুছুন" : "Delete"}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(t.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}
