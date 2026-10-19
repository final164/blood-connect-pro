import { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Lightbulb,
} from "lucide-react";

/** Fake Excel rows matching /samples/community-donors-sample.csv */
const EXCEL_COLS = [
  { key: "A", en: "name", bn: "নাম", sample: "রফিক উদ্দিন" },
  { key: "B", en: "phone", bn: "ফোন", sample: "01711111111" },
  { key: "C", en: "blood_group", bn: "গ্রুপ", sample: "O+" },
  { key: "D", en: "gender", bn: "লিঙ্গ", sample: "male" },
  { key: "E", en: "address", bn: "ঠিকানা", sample: "মিরপুর-১০" },
] as const;

const EXCEL_ROWS = [
  ["রফিক উদ্দিন", "01711111111", "O+", "male", "মিরপুর-১০"],
  ["সালমা খাতুন", "01822222222", "A+", "female", "গুলশান-২"],
  ["করিম হোসেন", "01933333333", "B+", "male", "আগ্রাবাদ"],
] as const;

/**
 * Visual Excel-style guide for bulk donor import (Donors tab).
 * Pure CSS mock — no image assets, zero network cost.
 */
export function OrgBulkUploadGuide({ lang }: { lang: "bn" | "en" }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/40"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
          <BookOpen className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {lang === "bn" ? "বাল্ক আপলোড গাইড" : "Bulk upload guide"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {lang === "bn"
              ? "Excel কেমন দেখাবে — কলাম ও উদাহরণ"
              : "How your Excel should look — columns & examples"}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 border-t px-3 pb-4 pt-3 sm:px-4">
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/samples/community-donors-sample.xlsx"
                download
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                {lang === "bn" ? "স্যাম্পল Excel" : "Sample Excel"}
              </a>
              <a
                href="/samples/community-donors-sample.csv"
                download
                className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </a>
              <p className="flex items-center gap-1 text-[10px] text-muted-foreground sm:ml-auto">
                <Lightbulb className="h-3 w-3 text-amber-500" />
                {lang === "bn"
                  ? "হেডার সারি বদলাবেন না"
                  : "Don’t rename header row"}
              </p>
            </div>

            {/* Excel window chrome */}
            <div className="overflow-hidden rounded-xl border border-[#217346]/40 shadow-sm dark:border-emerald-800/50">
              <div className="flex items-center gap-2 bg-[#217346] px-3 py-1.5 text-white">
                <FileSpreadsheet className="h-3.5 w-3.5 opacity-90" />
                <span className="truncate text-[11px] font-semibold tracking-wide">
                  community-donors-sample.xlsx
                </span>
                <span className="ml-auto rounded bg-white/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                  Excel
                </span>
              </div>
              <div className="flex border-b bg-[#f3f3f3] text-[10px] dark:bg-muted/80">
                <span className="border-r px-2 py-1 font-medium text-[#217346]">
                  Sheet1
                </span>
                <span className="px-2 py-1 text-muted-foreground">+</span>
              </div>

              <div className="overflow-x-auto bg-white dark:bg-card">
                <table className="w-full min-w-[520px] border-collapse text-left text-[11px]">
                  <thead>
                    <tr className="bg-[#e7e6e6] dark:bg-muted">
                      <th className="w-8 border border-black/10 bg-[#f2f2f2] p-0 text-center text-[9px] font-bold text-muted-foreground dark:bg-muted/60">
                        #
                      </th>
                      {EXCEL_COLS.map((c) => (
                        <th
                          key={c.key}
                          className="border border-black/10 px-2 py-1 text-center text-[10px] font-bold text-muted-foreground"
                        >
                          {c.key}
                        </th>
                      ))}
                    </tr>
                    <tr className="bg-[#d9ead3] dark:bg-emerald-950/40">
                      <td className="border border-black/10 bg-[#f2f2f2] px-1 py-1.5 text-center text-[9px] font-semibold text-muted-foreground dark:bg-muted/60">
                        1
                      </td>
                      {EXCEL_COLS.map((c) => (
                        <td
                          key={c.key}
                          className="border border-black/10 px-2 py-1.5 font-bold text-[#1b5e20] dark:text-emerald-300"
                        >
                          <span className="block truncate">{c.en}</span>
                          <span className="block truncate text-[9px] font-medium text-emerald-800/70 dark:text-emerald-400/70">
                            {lang === "bn" ? c.bn : c.en}
                          </span>
                        </td>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {EXCEL_ROWS.map((row, i) => (
                      <tr
                        key={i}
                        className={i % 2 === 0 ? "bg-white dark:bg-card" : "bg-[#fafafa] dark:bg-muted/20"}
                      >
                        <td className="border border-black/10 bg-[#f2f2f2] px-1 py-1.5 text-center text-[9px] font-semibold text-muted-foreground dark:bg-muted/60">
                          {i + 2}
                        </td>
                        {row.map((cell, j) => (
                          <td
                            key={j}
                            className="border border-black/10 px-2 py-1.5 text-foreground"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="bg-[#fffde7]/80 dark:bg-amber-950/20">
                      <td className="border border-black/10 bg-[#f2f2f2] px-1 py-1.5 text-center text-[9px] text-muted-foreground dark:bg-muted/60">
                        …
                      </td>
                      <td
                        colSpan={5}
                        className="border border-black/10 px-2 py-1.5 text-[10px] italic text-muted-foreground"
                      >
                        {lang === "bn"
                          ? "প্রতি সারিতে একজন রক্তদাতা — যত খুশি সারি যোগ করুন"
                          : "One donor per row — add as many rows as you need"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-1 border-t bg-[#f3f3f3] px-3 py-2 text-[10px] text-muted-foreground dark:bg-muted/50">
                <span>
                  <strong className="text-foreground">gender:</strong> male / female
                </span>
                <span>
                  <strong className="text-foreground">blood_group:</strong> A+ B+ O+ AB+ …
                </span>
                <span>
                  <strong className="text-foreground">phone:</strong>{" "}
                  {lang === "bn" ? "১১ ডিজিট" : "11 digits"}
                </span>
              </div>
            </div>

            <ol className="grid gap-2 sm:grid-cols-3">
              {[
                {
                  n: "01",
                  bn: "স্যাম্পল ডাউনলোড করে Excel-এ খুলুন",
                  en: "Download sample & open in Excel",
                },
                {
                  n: "02",
                  bn: "নিজের ডোনার ডেটা ভরুন (হেডার রাখুন)",
                  en: "Fill your donors (keep headers)",
                },
                {
                  n: "03",
                  bn: "জেলা সিলেক্ট → ফাইল বাছুন → ইমপোর্ট",
                  en: "Pick district → choose file → Import",
                },
              ].map((s) => (
                <li
                  key={s.n}
                  className="flex gap-2 rounded-xl border bg-muted/30 px-3 py-2.5"
                >
                  <span className="text-[10px] font-bold tabular-nums text-primary">
                    {s.n}
                  </span>
                  <span className="text-[11px] font-medium leading-snug">
                    {lang === "bn" ? s.bn : s.en}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
