import { toDisplayDigits } from "@tahkeem/shared";
import type { PassageVerse } from "../types";

/**
 * Renders a full mushaf page (or pages) as flowing serif Arabic text. Verses
 * within the question span carry `highlighted` and get a subtle grey wash — not
 * green — so the passage reads like a printed page with a marked stretch. A
 * decorated surah-name band precedes any verse where `startsSurah` is true.
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

      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 leading-[2.4] sm:p-6">
        <p className="text-justify font-arabic-body text-2xl text-on-surface">
          {verses.map((verse) => (
            <span key={verse.id}>
              {verse.startsSurah ? (
                <span className="my-3 flex items-center justify-center gap-3 py-1">
                  <span className="h-px flex-1 bg-outline-variant" aria-hidden />
                  <span className="rounded-full border border-outline-variant bg-surface-container px-4 py-1 font-arabic-display text-lg text-primary">
                    سُورَة {verse.suraNameAr}
                  </span>
                  <span className="h-px flex-1 bg-outline-variant" aria-hidden />
                </span>
              ) : null}
              <span
                className={
                  verse.highlighted
                    ? "rounded bg-surface-container-highest px-1 py-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
                    : undefined
                }
              >
                {verse.ayaText}{" "}
                <span className="mx-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-outline-variant align-middle font-body-md text-xs text-on-surface-variant">
                  {toDisplayDigits(verse.ayaNumber)}
                </span>{" "}
              </span>
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
