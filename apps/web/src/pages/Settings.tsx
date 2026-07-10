import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PENALTY_WEIGHTS,
  round2,
  toArabicDigits,
} from "@tahkeem/shared";
import { useCompetition, useUpdateScoring } from "../hooks";
import { useSelectedCompetition } from "../lib/competitionContext";
import { apiErrorMessage } from "../lib/api";
import {
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  Skeleton,
} from "../components/ui";
import type {
  Criterion,
  ScoringPenaltyInput,
  ScoringUpdate,
} from "../types";

interface DirectDraft {
  key: string;
  labelAr: string;
  descriptionAr: string | null;
  maxPoints: number;
  sortOrder: number;
}

interface PenaltyDraft {
  kind: "TALATHUM" | "TANBIH" | "FATH";
  labelAr: string;
  weight: number;
}

const PENALTY_ORDER: PenaltyDraft["kind"][] = ["FATH", "TANBIH", "TALATHUM"];
const PENALTY_DEFAULT_LABEL: Record<PenaltyDraft["kind"], string> = {
  FATH: "فتح",
  TANBIH: "تنبيه",
  TALATHUM: "تلعثم",
};
const PENALTY_DEFAULT_WEIGHT: Record<PenaltyDraft["kind"], number> = {
  FATH: DEFAULT_PENALTY_WEIGHTS.fath,
  TANBIH: DEFAULT_PENALTY_WEIGHTS.tanbih,
  TALATHUM: DEFAULT_PENALTY_WEIGHTS.talathum,
};

export function SettingsPage() {
  const { selectedId } = useSelectedCompetition();
  const competition = useCompetition(selectedId ?? undefined);
  const update = useUpdateScoring(selectedId ?? "");

  const [penaltyCriterion, setPenaltyCriterion] = useState<Criterion | null>(
    null,
  );
  const [hifzBase, setHifzBase] = useState(60);
  const [directs, setDirects] = useState<DirectDraft[]>([]);
  const [penalties, setPenalties] = useState<PenaltyDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  // Hydrate the editable draft from the competition's criteria & penalty rules.
  useEffect(() => {
    const data = competition.data;
    if (!data) return;
    const penalty = data.criteria.find((c) => c.kind === "PENALTY") ?? null;
    setPenaltyCriterion(penalty);
    setHifzBase(penalty?.maxPoints ?? 60);
    setDirects(
      data.criteria
        .filter((c) => c.kind === "DIRECT")
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((c) => ({
          key: c.key,
          labelAr: c.labelAr,
          descriptionAr: c.descriptionAr,
          maxPoints: c.maxPoints,
          sortOrder: c.sortOrder,
        })),
    );
    setPenalties(
      PENALTY_ORDER.map((kind) => {
        const rule = data.penaltyRules.find((r) => r.kind === kind);
        return {
          kind,
          labelAr: rule?.labelAr ?? PENALTY_DEFAULT_LABEL[kind],
          weight: rule?.weight ?? PENALTY_DEFAULT_WEIGHT[kind],
        };
      }),
    );
  }, [competition.data]);

  const directTotal = useMemo(
    () => directs.reduce((sum, d) => sum + (Number(d.maxPoints) || 0), 0),
    [directs],
  );
  const grandTotal = round2(hifzBase + directTotal);

  function updateDirect(index: number, patch: Partial<DirectDraft>) {
    setDirects((list) =>
      list.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    );
  }

  function updatePenalty(index: number, weight: number) {
    setPenalties((list) =>
      list.map((p, i) => (i === index ? { ...p, weight } : p)),
    );
  }

  async function submit() {
    if (!selectedId || !penaltyCriterion) return;
    setError(null);
    setSuccess(null);

    const payload: ScoringUpdate = {
      criteria: [
        {
          key: penaltyCriterion.key,
          labelAr: penaltyCriterion.labelAr,
          descriptionAr: penaltyCriterion.descriptionAr ?? undefined,
          kind: "PENALTY",
          maxPoints: Number(hifzBase),
          sortOrder: penaltyCriterion.sortOrder,
        },
        ...directs.map<ScoringUpdate["criteria"][number]>((d, i) => ({
          key: d.key,
          labelAr: d.labelAr,
          descriptionAr: d.descriptionAr ?? undefined,
          kind: "DIRECT",
          maxPoints: Number(d.maxPoints),
          sortOrder: d.sortOrder || i + 1,
        })),
      ],
      penaltyRules: penalties.map<ScoringPenaltyInput>((p) => ({
        kind: p.kind,
        labelAr: p.labelAr,
        weight: Number(p.weight),
      })),
    };

    try {
      await update.mutateAsync(payload);
      setSuccess("تم حفظ إعدادات التقييم بنجاح.");
      setLocked(false);
    } catch (err) {
      // A 400 here means a result was already submitted — lock the form.
      setError(apiErrorMessage(err));
      setLocked(true);
    }
  }

  if (!selectedId) {
    return (
      <EmptyState
        icon="tune"
        title="اختر مسابقة أولًا"
        hint="حدّد المسابقة من القائمة الجانبية لضبط إعدادات التقييم."
      />
    );
  }

  if (competition.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (competition.isError || !competition.data) {
    return (
      <ErrorState
        message={apiErrorMessage(competition.error)}
        onRetry={() => competition.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-headline-lg text-3xl text-on-surface">
          إعدادات التقييم
        </h1>
        <p className="mt-1 font-body-md text-sm text-on-surface-variant">
          {competition.data.name}
        </p>
      </header>

      {locked ? (
        <Banner tone="error">
          {error ??
            "تعذّر التعديل: تم اعتماد نتائج في هذه المسابقة، فأصبحت إعدادات التقييم للقراءة فقط."}
        </Banner>
      ) : null}
      {success ? (
        <Banner tone="success" onDismiss={() => setSuccess(null)}>
          {success}
        </Banner>
      ) : null}
      {error && !locked ? (
        <Banner tone="error" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="p-6">
            <h2 className="mb-1 font-headline-md text-lg text-on-surface">
              درجة الحفظ
            </h2>
            <p className="mb-4 font-body-md text-sm text-on-surface-variant">
              درجة الحفظ محسوبة آليًا وليست شريطًا. حدّد القيمة القصوى (الأساس).
            </p>
            <div className="flex items-center gap-3">
              <label className="font-label-md text-sm text-on-surface-variant">
                أساس الحفظ (hifzBase)
              </label>
              <Input
                type="number"
                min={1}
                step="0.5"
                disabled={locked}
                value={hifzBase}
                onChange={(e) => setHifzBase(Number(e.target.value))}
                className="w-28"
              />
              <span className="font-body-md text-sm text-on-surface-variant">
                نقطة
              </span>
            </div>

            <div className="mt-4 rounded-lg bg-surface-container-low p-4 font-arabic-body text-sm leading-relaxed text-on-surface-variant">
              عدد الحفظ = الأساس − (ملغى×نقاط السؤال + فتح×
              {toArabicDigits(penalties.find((p) => p.kind === "FATH")?.weight ?? 1.5)}{" "}
              + تنبيه×
              {toArabicDigits(
                penalties.find((p) => p.kind === "TANBIH")?.weight ?? 0.75,
              )}{" "}
              + تلعثم×
              {toArabicDigits(
                penalties.find((p) => p.kind === "TALATHUM")?.weight ?? 0.25,
              )}
              )، حيث نقاط السؤال = الأساس ÷ عدد الأسئلة.
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-1 font-headline-md text-lg text-on-surface">
              أوزان الخصم
            </h2>
            <p className="mb-4 font-body-md text-sm text-on-surface-variant">
              مقدار الخصم عن كل حالة أثناء التلاوة.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {penalties.map((penalty, index) => (
                <div
                  key={penalty.kind}
                  className="flex flex-col gap-1.5 rounded-lg border border-outline-variant p-3"
                >
                  <span className="font-arabic-body text-base text-on-surface">
                    {penalty.labelAr}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.05"
                    disabled={locked}
                    value={penalty.weight}
                    onChange={(e) =>
                      updatePenalty(index, Number(e.target.value))
                    }
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-1 font-headline-md text-lg text-on-surface">
              المعايير المباشرة
            </h2>
            <p className="mb-4 font-body-md text-sm text-on-surface-variant">
              معايير يقيّمها المحكّم مباشرة (تجويد، أداء) بقيمة قصوى لكل منها.
            </p>
            {directs.length === 0 ? (
              <p className="font-body-md text-sm text-on-surface-variant">
                لا توجد معايير مباشرة.
              </p>
            ) : (
              <div className="space-y-3">
                {directs.map((direct, index) => (
                  <div
                    key={direct.key}
                    className="flex flex-wrap items-end gap-3 rounded-lg border border-outline-variant p-3"
                  >
                    <div className="flex flex-1 flex-col gap-1.5">
                      <label className="font-label-md text-xs text-on-surface-variant">
                        الاسم
                      </label>
                      <Input
                        disabled={locked}
                        value={direct.labelAr}
                        onChange={(e) =>
                          updateDirect(index, { labelAr: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex w-32 flex-col gap-1.5">
                      <label className="font-label-md text-xs text-on-surface-variant">
                        القيمة القصوى
                      </label>
                      <Input
                        type="number"
                        min={0}
                        step="0.5"
                        disabled={locked}
                        value={direct.maxPoints}
                        onChange={(e) =>
                          updateDirect(index, {
                            maxPoints: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="sticky top-6 p-6">
            <div className="mb-3 flex items-center gap-2 text-on-surface-variant">
              <Icon name="calculate" className="text-[20px]" />
              <h3 className="font-label-md text-sm font-medium">
                الدرجة الكلّية القصوى
              </h3>
            </div>
            <div className="space-y-2 font-body-md text-sm">
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">أساس الحفظ</span>
                <span className="text-on-surface" dir="ltr">
                  {hifzBase}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">
                  مجموع المعايير المباشرة
                </span>
                <span className="text-on-surface" dir="ltr">
                  {round2(directTotal)}
                </span>
              </div>
              <div className="my-2 border-t border-outline-variant" />
              <div className="flex items-center justify-between">
                <span className="font-medium text-on-surface">الإجمالي</span>
                <span
                  className="font-headline-md text-2xl text-primary"
                  dir="ltr"
                >
                  {grandTotal}
                </span>
              </div>
            </div>

            <Button
              className="mt-6 w-full"
              icon="save"
              disabled={locked || !penaltyCriterion}
              loading={update.isPending}
              onClick={submit}
            >
              حفظ الإعدادات
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
