import { toArabicDigits } from "@tahkeem/shared";
import { Chip, Icon } from "./ui";
import type { ScopeEndpoint, ScopeKind } from "../types";

export interface ScopeLike {
  kind: ScopeKind;
  reversed: boolean;
  verseCount: number;
  start: ScopeEndpoint;
  end: ScopeEndpoint;
}

function endpoint(point: ScopeEndpoint): string {
  return `${point.surah}:${toArabicDigits(point.ayah)}`;
}

/** «من البقرة:١ إلى الصافات:١٨٢ — ٣٩٥٧ آية» plus a reversed badge. */
export function ScopeSummary({ scope }: { scope: ScopeLike }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-arabic-body text-lg text-on-surface">
        <span>من</span>
        <span className="font-medium text-primary">{endpoint(scope.start)}</span>
        <span>إلى</span>
        <span className="font-medium text-primary">{endpoint(scope.end)}</span>
        <span className="text-on-surface-variant">
          — {toArabicDigits(scope.verseCount)} آية
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 font-body-md text-xs text-on-surface-variant">
        <span>
          الصفحات {toArabicDigits(scope.start.page)}–
          {toArabicDigits(scope.end.page)}
        </span>
        {scope.reversed ? (
          <Chip className="bg-error-container text-on-error-container">
            <Icon name="swap_horiz" className="text-[16px]" />
            مكتوب بالمقلوب
          </Chip>
        ) : null}
      </div>
    </div>
  );
}
