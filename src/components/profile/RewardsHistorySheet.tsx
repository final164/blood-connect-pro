import { useEffect, useState } from "react";
import { Trophy, X } from "lucide-react";
import {
  fetchRewardLedger,
  rewardActionLabel,
  type RewardLedgerRow,
} from "@/lib/rewards";
import { fetchRewardsSettings, levelName } from "@/lib/rewards-settings";

export function RewardsHistorySheet({
  open,
  onClose,
  userId,
  lang,
  points,
  level,
  lifetime,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  lang: "bn" | "en";
  points: number;
  level: number;
  lifetime: number;
}) {
  const [rows, setRows] = useState<RewardLedgerRow[]>([]);
  const [levelLabel, setLevelLabel] = useState("");

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const [ledger, settings] = await Promise.all([
        fetchRewardLedger(userId, 50),
        fetchRewardsSettings(),
      ]);
      setRows(ledger);
      setLevelLabel(levelName(settings, level, lang));
    })();
  }, [open, userId, level, lang]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md max-h-[80vh] overflow-hidden rounded-t-2xl sm:rounded-2xl border bg-card shadow-xl flex flex-col">
        <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Trophy className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate">
                {lang === "bn" ? "রিওয়ার্ড হিস্টরি" : "Rewards history"}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {points} pts · {lang === "bn" ? "লেভেল" : "Level"} {level}
                {levelLabel ? ` (${levelLabel})` : ""} · {lifetime}{" "}
                {lang === "bn" ? "লাইফটাইম" : "lifetime"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full grid place-items-center hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <ul className="overflow-y-auto flex-1 px-4 py-2 space-y-1">
          {rows.length === 0 && (
            <li className="py-8 text-center text-sm text-muted-foreground">
              {lang === "bn" ? "এখনো কোনো পয়েন্ট নেই" : "No points yet"}
            </li>
          )}
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{rewardActionLabel(r.action, lang)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB")}
                </p>
              </div>
              <span
                className={`shrink-0 font-semibold tabular-nums ${
                  r.points >= 0 ? "text-emerald-600" : "text-destructive"
                }`}
              >
                {r.points >= 0 ? "+" : ""}
                {r.points}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
