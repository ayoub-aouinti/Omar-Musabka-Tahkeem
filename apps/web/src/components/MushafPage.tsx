import { toArabicDigits, toDisplayDigits } from "@tahkeem/shared";
import type { PassageVerse } from "../types";

/**
 * Renders a full mushaf page (or pages) in the Qaloun Uthmanic typeface, styled
 * after a printed mushaf: a parchment page frame and a gilded double-bordered
 * surah-name band. Verses within the question span carry `highlighted` and get
 * a subtle grey wash — not green — so the passage reads like a printed page
 * with a marked stretch.
 */
export function MushafPage({
  verses,
  pages,
}: {
  verses: PassageVerse[];
  pages?: string[];
}) {
  if (verses.length === 0) {
    return (
      <p className="py-12 text-center font-body-md text-sm text-on-surface-variant">
        لا توجد آيات لعرضها.
      </p>
    );
  }

  return (
    <div dir="rtl" className="flex flex-col gap-3">
      {pages && pages.length > 0 ? (
        <div className="flex items-center justify-center gap-2 font-label-md text-xs text-on-surface-variant">
          <span>الصفحة</span>
          <span>{pages.map((p) => toDisplayDigits(p)).join(" – ")}</span>
        </div>
      ) : null}

      <div className="rounded-xl border-2 border-primary-container/40 bg-[#fbf6e9] p-6 leading-[2.7] shadow-inner ring-1 ring-inset ring-primary-container/20 sm:p-8">
        {/*
         * text-right, not text-justify: the mushaf panel is a narrow modal
         * column, and CSS justify has no kashida support -- once a line holds
         * only one or two words it stretches the gap between them to fill the
         * line, which reads as broken rather than "printed". A non-breaking
         * space glues each ayah number to its verse's last word so the
         * number circle never wraps onto a line by itself.
         */}
        <p className="text-right font-mushaf text-xl text-on-surface sm:text-2xl">
          {verses.map((verse) => (
            <span key={verse.id}>
              {verse.startsSurah ? (
                <span className="my-3 flex items-center justify-center gap-3 py-1">
                  <span className="h-px flex-1 bg-primary-container/40" aria-hidden />
                  <span className="rounded border-2 border-double border-primary-container/60 bg-primary-container/10 px-4 py-1 font-mushaf text-base text-primary sm:text-lg">
                    سُورَةُ {verse.suraNameAr}
                  </span>
                  <span className="h-px flex-1 bg-primary-container/40" aria-hidden />
                </span>
              ) : null}
              <span
                className={
                  verse.highlighted
                    ? "rounded bg-surface-container-highest px-1 py-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
                    : undefined
                }
              >
                {verse.ayaText}
                {" "}
                {/* Amiri, not font-mushaf: UthmanicQaloun substitutes Arabic-Indic
                    digits with a plain ayah-end rosette (no numeral drawn), so the
                    number itself needs a font that actually renders the digit. The
                    non-breaking space above keeps the circle glued to the verse's
                    last word instead of wrapping onto a line by itself. */}
                <span className="mx-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-primary-container/50 bg-primary-container/10 align-middle font-arabic-body text-sm leading-none text-primary">
                  {toArabicDigits(verse.ayaNumber)}
                </span>{" "}
              </span>
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
