import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toArabicDigits } from "@tahkeem/shared";
import {
  useCompetition,
  useGenerateCategoryQuestions,
  useUpsertCategory,
} from "../hooks";
import { apiErrorMessage } from "../lib/api";
import {
  AMOUNT_UNITS,
  AMOUNT_UNIT_LABELS,
  STATUS_CHIP,
  STATUS_LABELS,
  formatAmount,
  formatDate,
} from "../lib/labels";
import {
  Banner,
  Button,
  Card,
  Chip,
  ErrorState,
  Icon,
  Input,
  Select,
  Skeleton,
} from "../components/ui";
import type { AmountUnit, Category, CategoryGenerateResult } from "../types";

interface RowDraft {
  hizbCount: number;
  labelAr: string;
  questionCount: number;
  amountUnit: AmountUnit;
  amountValue: number;
}

function CategoryRow({
  category,
  competitionId,
}: {
  category: Category;
  competitionId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RowDraft>({
    hizbCount: category.hizbCount,
    labelAr: category.labelAr,
    questionCount: category.questionCount,
    amountUnit: category.amountUnit,
    amountValue: category.amountValue,
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<CategoryGenerateResult | null>(null);

  const upsert = useUpsertCategory(competitionId);
  const generate = useGenerateCategoryQuestions();

  async function save() {
    setFeedback(null);
    try {
      await upsert.mutateAsync(draft);
      setEditing(false);
    } catch (error) {
      setFeedback(apiErrorMessage(error));
    }
  }

  async function runGenerate(regenerate: boolean) {
    setGenResult(null);
    setFeedback(null);
    try {
      const result = await generate.mutateAsync({
        categoryId: category.id,
        regenerate,
      });
      setGenResult(result);
    } catch (error) {
      setFeedback(apiErrorMessage(error));
    }
  }

  return (
    <>
      <tr className="border-b border-outline-variant/60">
        <td className="px-4 py-3 font-body-md text-sm text-on-surface">
          {editing ? (
            <Input
              type="number"
              min={1}
              value={draft.hizbCount}
              onChange={(e) =>
                setDraft((d) => ({ ...d, hizbCount: Number(e.target.value) }))
              }
              className="w-20"
            />
          ) : (
            toArabicDigits(category.hizbCount)
          )}
        </td>
        <td className="px-4 py-3 font-body-md text-sm font-medium text-on-surface">
          {editing ? (
            <Input
              value={draft.labelAr}
              onChange={(e) =>
                setDraft((d) => ({ ...d, labelAr: e.target.value }))
              }
              className="w-40"
            />
          ) : (
            category.labelAr
          )}
        </td>
        <td className="px-4 py-3 font-body-md text-sm text-on-surface">
          {editing ? (
            <Input
              type="number"
              min={1}
              value={draft.questionCount}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  questionCount: Number(e.target.value),
                }))
              }
              className="w-20"
            />
          ) : (
            toArabicDigits(category.questionCount)
          )}
        </td>
        <td className="px-4 py-3 font-body-md text-sm text-on-surface">
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={draft.amountValue}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    amountValue: Number(e.target.value),
                  }))
                }
                className="w-20"
              />
              <Select
                value={draft.amountUnit}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    amountUnit: e.target.value as AmountUnit,
                  }))
                }
              >
                {AMOUNT_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {AMOUNT_UNIT_LABELS[u]}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            formatAmount(category.amountValue, category.amountUnit)
          )}
        </td>
        <td className="px-4 py-3 font-body-md text-sm text-on-surface">
          {toArabicDigits(category._count?.candidates ?? 0)}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-2">
            {editing ? (
              <>
                <Button variant="primary" loading={upsert.isPending} onClick={save}>
                  حفظ
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setDraft({
                      hizbCount: category.hizbCount,
                      labelAr: category.labelAr,
                      questionCount: category.questionCount,
                      amountUnit: category.amountUnit,
                      amountValue: category.amountValue,
                    });
                  }}
                >
                  إلغاء
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  icon="edit"
                  onClick={() => setEditing(true)}
                >
                  تعديل
                </Button>
                <Button
                  variant="primary"
                  icon="auto_awesome"
                  loading={generate.isPending}
                  onClick={() => runGenerate(false)}
                >
                  توليد أسئلة الصنف
                </Button>
              </>
            )}
          </div>
        </td>
      </tr>
      {(feedback || genResult) && (
        <tr>
          <td colSpan={6} className="px-4 pb-4">
            {feedback ? (
              <Banner tone="error" onDismiss={() => setFeedback(null)}>
                {feedback}
              </Banner>
            ) : null}
            {genResult ? (
              <div className="mt-2 space-y-2">
                <Banner
                  tone={genResult.failed.length ? "info" : "success"}
                  onDismiss={() => setGenResult(null)}
                >
                  تم توليد الأسئلة لـ{" "}
                  {toArabicDigits(genResult.generated)} مشارك.
                  {genResult.failed.length
                    ? ` تعذّر التوليد لـ ${toArabicDigits(
                        genResult.failed.length,
                      )} مشارك.`
                    : ""}
                  <button
                    className="ms-2 underline"
                    onClick={() => runGenerate(true)}
                  >
                    إعادة التوليد بالكامل
                  </button>
                </Banner>
                {genResult.failed.length ? (
                  <div className="overflow-hidden rounded-lg border border-outline-variant">
                    <table className="w-full text-start text-sm">
                      <thead>
                        <tr className="bg-surface-container text-start font-label-md text-xs text-on-surface-variant">
                          <th className="px-3 py-2 text-start font-medium">
                            المشارك
                          </th>
                          <th className="px-3 py-2 text-start font-medium">
                            السبب
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {genResult.failed.map((f, i) => (
                          <tr
                            key={i}
                            className="border-t border-outline-variant/60"
                          >
                            <td className="px-3 py-2 text-on-surface">
                              {f.candidate}
                            </td>
                            <td className="px-3 py-2 text-error">{f.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : null}
          </td>
        </tr>
      )}
    </>
  );
}

export function CompetitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = useCompetition(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />
    );
  }

  return (
    <div className="flex flex-col gap-margin-lg">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-headline-lg text-3xl text-on-surface">
              {data.name}
            </h1>
            <Chip className={STATUS_CHIP[data.status]}>
              {STATUS_LABELS[data.status]}
            </Chip>
          </div>
          <p className="mt-1 font-body-md text-sm text-on-surface-variant">
            {data.location ?? "بدون مكان محدّد"} · تبدأ في{" "}
            {formatDate(data.startDate)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/settings">
            <Button variant="outline" icon="tune">
              إعدادات التقييم
            </Button>
          </Link>
          <Link to="/candidates">
            <Button variant="outline" icon="groups">
              المشاركون
            </Button>
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-gutter-md sm:grid-cols-4">
        <Card className="p-4">
          <p className="font-label-md text-xs text-on-surface-variant">
            المشاركون
          </p>
          <p className="mt-1 font-headline-lg text-2xl text-on-surface">
            {toArabicDigits(data._count.candidates)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="font-label-md text-xs text-on-surface-variant">
            الأصناف
          </p>
          <p className="mt-1 font-headline-lg text-2xl text-on-surface">
            {toArabicDigits(data.categories.length)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="font-label-md text-xs text-on-surface-variant">
            المعايير
          </p>
          <p className="mt-1 font-headline-lg text-2xl text-on-surface">
            {toArabicDigits(data.criteria.length)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="font-label-md text-xs text-on-surface-variant">
            قواعد الخصم
          </p>
          <p className="mt-1 font-headline-lg text-2xl text-on-surface">
            {toArabicDigits(data.penaltyRules.length)}
          </p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-outline-variant px-container-padding py-4">
          <h2 className="font-headline-md text-lg text-on-surface">الأصناف</h2>
          <p className="mt-0.5 font-body-md text-xs text-on-surface-variant">
            حرّر بيانات الصنف مباشرة، أو ولّد أسئلة كامل الصنف.
          </p>
        </div>
        {data.categories.length === 0 ? (
          <p className="px-container-padding py-8 text-center font-body-md text-sm text-on-surface-variant">
            لا توجد أصناف لهذه المسابقة.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-outline-variant text-start font-label-md text-xs text-on-surface-variant">
                  <th className="px-4 py-3 text-start font-medium">عدد الأحزاب</th>
                  <th className="px-4 py-3 text-start font-medium">الصنف</th>
                  <th className="px-4 py-3 text-start font-medium">عدد الأسئلة</th>
                  <th className="px-4 py-3 text-start font-medium">المقدار</th>
                  <th className="px-4 py-3 text-start font-medium">المشاركون</th>
                  <th className="px-4 py-3 text-end font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {data.categories.map((category) => (
                  <CategoryRow
                    key={category.id}
                    category={category}
                    competitionId={data.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
