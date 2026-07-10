import { useMemo, useState } from "react";
import { toArabicDigits } from "@tahkeem/shared";
import { useCompetition, useResults } from "../hooks";
import { useSelectedCompetition } from "../lib/competitionContext";
import { apiErrorMessage } from "../lib/api";
import {
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Select,
  Skeleton,
} from "../components/ui";

const MEDALS = ["#f6c945", "#c4c7c3", "#cd8a4b"];

export function ResultsPage() {
  const { selectedId } = useSelectedCompetition();
  const competition = useCompetition(selectedId ?? undefined);
  const [categoryId, setCategoryId] = useState("");
  const results = useResults(selectedId ?? undefined, categoryId);

  const categoryLabel = useMemo(() => {
    const map = new Map<string, string>();
    competition.data?.categories.forEach((c) => map.set(c.id, c.labelAr));
    return map;
  }, [competition.data]);

  const ranked = useMemo(
    () =>
      [...(results.data ?? [])].sort(
        (a, b) => b.averageScore - a.averageScore,
      ),
    [results.data],
  );

  if (!selectedId) {
    return (
      <EmptyState
        icon="leaderboard"
        title="اختر مسابقة أولًا"
        hint="حدّد المسابقة من القائمة الجانبية لعرض النتائج."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-3xl text-on-surface">النتائج</h1>
          <p className="mt-1 font-body-md text-sm text-on-surface-variant">
            ترتيب المشاركين حسب متوسّط درجات المحكّمين — {competition.data?.name}
          </p>
        </div>
        <Select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">كل الأصناف</option>
          {competition.data?.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.labelAr}
            </option>
          ))}
        </Select>
      </header>

      <Card className="overflow-hidden">
        {results.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : results.isError ? (
          <ErrorState
            message={apiErrorMessage(results.error)}
            onRetry={() => results.refetch()}
          />
        ) : ranked.length === 0 ? (
          <EmptyState
            icon="leaderboard"
            title="لا توجد نتائج بعد"
            hint="ستظهر النتائج بعد اعتماد المحكّمين لدرجاتهم."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-outline-variant text-start font-label-md text-xs text-on-surface-variant">
                  <th className="px-4 py-3 text-start font-medium">الترتيب</th>
                  <th className="px-4 py-3 text-start font-medium">المشارك</th>
                  <th className="px-4 py-3 text-start font-medium">الصنف</th>
                  <th className="px-4 py-3 text-start font-medium">
                    عدد المحكّمين
                  </th>
                  <th className="px-4 py-3 text-start font-medium">
                    متوسّط الدرجة
                  </th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((row, index) => (
                  <tr
                    key={row.candidate.id}
                    className={[
                      "border-b border-outline-variant/60",
                      index < 3 ? "row-active" : "",
                    ].join(" ")}
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 font-headline-md text-lg text-on-surface">
                        {index < 3 ? (
                          <Icon
                            name="workspace_premium"
                            className="text-[22px]"
                            // medal tint
                          />
                        ) : null}
                        <span style={index < 3 ? { color: MEDALS[index] } : undefined}>
                          {toArabicDigits(index + 1)}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 font-body-md text-sm font-medium text-on-surface">
                      {row.candidate.fullName}
                    </td>
                    <td className="px-4 py-3 font-body-md text-sm text-on-surface-variant">
                      {categoryLabel.get(row.candidate.categoryId) ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-body-md text-sm text-on-surface">
                      {toArabicDigits(row.judgeCount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="font-headline-md text-lg text-primary"
                        dir="ltr"
                      >
                        {row.averageScore.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
