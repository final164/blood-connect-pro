import type { CareAiMedicine } from "@/lib/care-ai-chat";
import { Pill } from "lucide-react";

export function CareAiMedicineBlock({
  items,
  title,
  disclaimer,
  lang,
}: {
  items: CareAiMedicine[] | null | undefined;
  title: string;
  disclaimer?: string;
  lang: "bn" | "en";
}) {
  if (!items?.length) return null;

  return (
    <div className="mt-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-violet-800 dark:text-violet-200 flex items-center gap-1.5">
        <Pill className="h-3.5 w-3.5" />
        {title}
      </p>
      {disclaimer ? <p className="text-[10px] text-muted-foreground leading-snug">{disclaimer}</p> : null}
      <ul className="space-y-2">
        {items.map((m, i) => {
          const name = m.suggested_name || m.name_as_written;
          const writtenDiff =
            m.name_as_written &&
            m.suggested_name &&
            m.name_as_written.trim().toLowerCase() !== m.suggested_name.trim().toLowerCase();
          return (
            <li key={`${name}-${i}`} className="rounded-lg border bg-background/80 px-2.5 py-2 text-xs space-y-1">
              <p className="font-semibold text-sm leading-snug">{name}</p>
              {writtenDiff ? (
                <p className="text-[10px] text-muted-foreground">
                  {lang === "bn" ? "লেখা ছিল" : "As written"}: {m.name_as_written}
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                {m.dose ? (
                  <p>
                    <span className="font-semibold text-foreground/80">{lang === "bn" ? "ডোজ" : "Dose"}:</span>{" "}
                    {m.dose}
                  </p>
                ) : null}
                {m.frequency ? (
                  <p>
                    <span className="font-semibold text-foreground/80">
                      {lang === "bn" ? "কতবার" : "Frequency"}:
                    </span>{" "}
                    {m.frequency}
                  </p>
                ) : null}
                {m.timing ? (
                  <p className="col-span-2">
                    <span className="font-semibold text-foreground/80">{lang === "bn" ? "কখন" : "When"}:</span>{" "}
                    {m.timing}
                  </p>
                ) : null}
                {m.duration ? (
                  <p className="col-span-2">
                    <span className="font-semibold text-foreground/80">
                      {lang === "bn" ? "কতদিন" : "Duration"}:
                    </span>{" "}
                    {m.duration}
                  </p>
                ) : null}
              </div>
              {m.notes ? <p className="text-[10px] text-muted-foreground pt-0.5">{m.notes}</p> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
