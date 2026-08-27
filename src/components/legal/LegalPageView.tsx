import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Mail, MapPin, Phone } from "lucide-react";
import {
  activeLegalSections,
  legalDocIntro,
  legalDocTitle,
  legalSectionBody,
  legalSectionHeading,
  parseLegalBody,
  type LegalDoc,
  type LegalSettings,
} from "@/lib/legal-settings";

function readStoredLang(): "bn" | "en" {
  if (typeof window === "undefined") return "bn";
  try {
    if (window.localStorage.getItem("lang") === "en") return "en";
  } catch {
    /* private mode */
  }
  return "bn";
}

function formatDate(iso: string, lang: "bn" | "en"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function LegalPageView({
  doc,
  legal,
  otherHref,
  otherLabelBn,
  otherLabelEn,
}: {
  doc: LegalDoc;
  legal: LegalSettings;
  otherHref: string;
  otherLabelBn: string;
  otherLabelEn: string;
}) {
  const [lang, setLang] = useState<"bn" | "en">(readStoredLang);

  useEffect(() => {
    setLang(readStoredLang());
  }, []);

  const sections = useMemo(() => activeLegalSections(doc), [doc]);
  const title = legalDocTitle(doc, lang);
  const intro = legalDocIntro(doc, lang);
  const updated = formatDate(doc.effective_date, lang);
  const address = lang === "bn" ? legal.contact_address_bn : legal.contact_address_en;

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div
          className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3"
          style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
        >
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-rose-600 dark:text-slate-300"
          >
            <ArrowLeft className="h-4 w-4" />
            {lang === "bn" ? "হোম" : "Home"}
          </Link>
          <button
            type="button"
            onClick={() => {
              const next = lang === "bn" ? "en" : "bn";
              setLang(next);
              try {
                window.localStorage.setItem("lang", next);
              } catch {
                /* private mode */
              }
            }}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-rose-500 hover:text-rose-600 dark:border-slate-700 dark:text-slate-300"
          >
            {lang === "bn" ? "English" : "বাংলা"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 pb-16">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>

        {updated && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <CalendarDays className="h-3.5 w-3.5" />
            {lang === "bn" ? `সর্বশেষ হালনাগাদ: ${updated}` : `Last updated: ${updated}`}
          </p>
        )}

        {intro && (
          <p className="mt-5 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
            {intro}
          </p>
        )}

        {sections.length > 1 && (
          <nav className="mt-7 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {lang === "bn" ? "সূচিপত্র" : "Contents"}
            </p>
            <ol className="mt-2 space-y-1 text-sm">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="text-slate-600 hover:text-rose-600 dark:text-slate-300"
                  >
                    {i + 1}. {legalSectionHeading(s, lang)}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="mt-8 space-y-8">
          {sections.map((s, i) => {
            const blocks = parseLegalBody(legalSectionBody(s, lang));
            return (
              <section key={s.id} id={s.id} className="scroll-mt-20">
                <h2 className="text-lg font-semibold">
                  {i + 1}. {legalSectionHeading(s, lang)}
                </h2>
                <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
                  {blocks.map((block, bi) =>
                    block.kind === "list" ? (
                      <ul key={bi} className="list-disc space-y-1.5 pl-5">
                        {block.items.map((item, ii) => (
                          <li key={ii}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p key={bi}>{block.text}</p>
                    ),
                  )}
                </div>
              </section>
            );
          })}
        </div>

        <section className="mt-12 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-semibold">
            {lang === "bn" ? "যোগাযোগ" : "Contact us"}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {lang === "bn"
              ? "এই নীতি সম্পর্কে কোনো প্রশ্ন থাকলে আমাদের জানান।"
              : "If you have any questions about this document, please reach out."}
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {legal.contact_email && (
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-rose-600" />
                <a className="hover:underline" href={`mailto:${legal.contact_email}`}>
                  {legal.contact_email}
                </a>
              </li>
            )}
            {legal.contact_phone && (
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-rose-600" />
                <a className="hover:underline" href={`tel:${legal.contact_phone}`}>
                  {legal.contact_phone}
                </a>
              </li>
            )}
            {address && (
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-rose-600" />
                <span>{address}</span>
              </li>
            )}
          </ul>
        </section>

        <p className="mt-8 text-sm">
          <a href={otherHref} className="font-medium text-rose-600 hover:underline">
            {lang === "bn" ? otherLabelBn : otherLabelEn}
          </a>
        </p>
      </main>
    </div>
  );
}

export function LegalPageDisabled({ lang = "bn" as "bn" | "en" }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center dark:bg-slate-950">
      <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
        {lang === "bn" ? "পেজটি এখন উপলব্ধ নয়" : "This page is not available"}
      </p>
      <Link to="/" className="text-sm font-medium text-rose-600 hover:underline">
        {lang === "bn" ? "হোমে ফিরে যান" : "Back to home"}
      </Link>
    </div>
  );
}
