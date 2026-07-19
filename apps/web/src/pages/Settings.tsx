import { useEffect, useMemo, useState } from "react";
import {
  autoCancelMessage,
  DEFAULT_PENALTY_WEIGHTS,
  round2,
  toDisplayDigits,
} from "@tahkeem/shared";
import { useCompetition, useUpdateAutoCancel, useUpdateScoring } from "../hooks";
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
  Textarea,
} from "../components/ui";
import type {
  Criterion,
  ScoringPenaltyInput,
  ScoringScaleInput,
  ScoringUpdate,
} from "../types";

interface BandDraft {
  minPoints: number;
  maxPoints: number;
  descriptionAr: string;
}

interface ScaleDraft {
  labelAr: string;
  minHizb: number;
  maxHizb: number;
  maxPoints: number;
  bands: BandDraft[];
}

interface DirectDraft {
  key: string;
  labelAr: string;
  descriptionAr: string | null;
  maxPoints: number;
  sortOrder: number;
  scales: ScaleDraft[];
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
  const updateAutoCancel = useUpdateAutoCancel(selectedId ?? "");

  const [penaltyCriterion, setPenaltyCriterion] = useState<Criterion | null>(
    null,
  );
  const [hifzBase, setHifzBase] = useState(60);
  const [total, setTotal] = useState(60);
  const [directs, setDirects] = useState<DirectDraft[]>([]);
  const [penalties, setPenalties] = useState<PenaltyDraft[]>([]);
  const [autoCancelEnabled, setAutoCancelEnabled] = useState(false);
  const [autoCancelThreshold, setAutoCancelThreshold] = useState(3);
  const [autoCancelError, setAutoCancelError] = useState<string | null>(null);
  const [autoCancelSuccess, setAutoCancelSuccess] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  // Hydrate the editable draft from the competition's criteria & penalty rules.
  useEffect(() => {
    const data = competition.data;
    if (!data) return;
    const penalty = data.criteria.find((c) => c.kind === "PENALTY") ?? null;
    setPenaltyCriterion(penalty);
    const nextHifzBase = penalty?.maxPoints ?? 60;
    setHifzBase(nextHifzBase);
    const directList = data.criteria
      .filter((c) => c.kind === "DIRECT")
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({
        key: c.key,
        labelAr: c.labelAr,
        descriptionAr: c.descriptionAr,
        maxPoints: c.maxPoints,
        sortOrder: c.sortOrder,
        scales: (c.scales ?? [])
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((s) => ({
            labelAr: s.labelAr,
            minHizb: s.minHizb,
            maxHizb: s.maxHizb,
            maxPoints: s.maxPoints,
            bands: (s.bands ?? [])
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((b) => ({
                minPoints: b.minPoints,
                maxPoints: b.maxPoints,
                descriptionAr: b.descriptionAr ?? "",
              })),
          })),
      }));
    setDirects(directList);
    const nextDirectTotal = directList.reduce(
      (sum, d) => sum + (Number(d.maxPoints) || 0),
      0,
    );
    setTotal(round2(nextHifzBase + nextDirectTotal));
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
    setAutoCancelEnabled(data.autoCancelFathThreshold != null);
    setAutoCancelThreshold(data.autoCancelFathThreshold ?? 3);
  }, [competition.data]);

  const directTotal = useMemo(
    () => directs.reduce((sum, d) => sum + (Number(d.maxPoints) || 0), 0),
    [directs],
  );

  // Keeps hifzBase, the general-criteria sum, and the global total in sync:
  // editing one of the other two recomputes hifzBase so total stays fixed.
  function updateDirect(index: number, patch: Partial<DirectDraft>) {
    setDirects((list) => {
      const next = list.map((d, i) => (i === index ? { ...d, ...patch } : d));
      if (patch.maxPoints !== undefined) {
        const nextDirectTotal = next.reduce(
          (sum, d) => sum + (Number(d.maxPoints) || 0),
          0,
        );
        setHifzBase(round2(Math.max(0, total - nextDirectTotal)));
      }
      return next;
    });
  }

  function handleHifzBaseChange(value: number) {
    setHifzBase(value);
    setTotal(round2(value + directTotal));
  }

  function handleTotalChange(value: number) {
    setTotal(value);
    setHifzBase(round2(Math.max(0, value - directTotal)));
  }

  function mutateScales(
    dIndex: number,
    fn: (scales: ScaleDraft[]) => ScaleDraft[],
  ) {
    setDirects((list) =>
      list.map((d, i) => (i === dIndex ? { ...d, scales: fn(d.scales) } : d)),
    );
  }

  function updateScale(
    dIndex: number,
    sIndex: number,
    patch: Partial<ScaleDraft>,
  ) {
    mutateScales(dIndex, (scales) =>
      scales.map((s, i) => (i === sIndex ? { ...s, ...patch } : s)),
    );
  }

  function addScale(dIndex: number) {
    mutateScales(dIndex, (scales) => [
      ...scales,
      { labelAr: "", minHizb: 1, maxHizb: 60, maxPoints: 10, bands: [] },
    ]);
  }

  function removeScale(dIndex: number, sIndex: number) {
    mutateScales(dIndex, (scales) => scales.filter((_, i) => i !== sIndex));
  }

  function mutateBands(
    dIndex: number,
    sIndex: number,
    fn: (bands: BandDraft[]) => BandDraft[],
  ) {
    mutateScales(dIndex, (scales) =>
      scales.map((s, i) =>
        i === sIndex ? { ...s, bands: fn(s.bands) } : s,
      ),
    );
  }

  function updateBand(
    dIndex: number,
    sIndex: number,
    bIndex: number,
    patch: Partial<BandDraft>,
  ) {
    mutateBands(dIndex, sIndex, (bands) =>
      bands.map((b, i) => (i === bIndex ? { ...b, ...patch } : b)),
    );
  }

  function addBand(dIndex: number, sIndex: number) {
    mutateBands(dIndex, sIndex, (bands) => [
      ...bands,
      { minPoints: 0, maxPoints: 0, descriptionAr: "" },
    ]);
  }

  function removeBand(dIndex: number, sIndex: number, bIndex: number) {
    mutateBands(dIndex, sIndex, (bands) => bands.filter((_, i) => i !== bIndex));
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
          scales: d.scales.map<ScoringScaleInput>((s) => ({
            labelAr: s.labelAr,
            minHizb: Number(s.minHizb),
            maxHizb: Number(s.maxHizb),
            maxPoints: Number(s.maxPoints),
            bands: s.bands.map((b) => ({
              minPoints: Number(b.minPoints),
              maxPoints: Number(b.maxPoints),
              descriptionAr: b.descriptionAr,
            })),
          })),
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

  /**
   * Saved separately from `submit()`: this never rewrites an already-graded
   * question, so it stays editable even once the rest of the form is locked.
   */
  async function submitAutoCancel() {
    if (!selectedId) return;
    setAutoCancelError(null);
    setAutoCancelSuccess(null);
    try {
      await updateAutoCancel.mutateAsync(
        autoCancelEnabled ? Number(autoCancelThreshold) : null,
      );
      setAutoCancelSuccess("تم حفظ إعداد الإلغاء التلقائي بنجاح.");
    } catch (err) {
      setAutoCancelError(apiErrorMessage(err));
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
                onChange={(e) => handleHifzBaseChange(Number(e.target.value))}
                className="w-28"
              />
              <span className="font-body-md text-sm text-on-surface-variant">
                نقطة
              </span>
            </div>

            <div className="mt-4 rounded-lg bg-surface-container-low p-4 font-arabic-body text-sm leading-relaxed text-on-surface-variant">
              عدد الحفظ = الأساس − (ملغى×نقاط السؤال + فتح×
              {toDisplayDigits(penalties.find((p) => p.kind === "FATH")?.weight ?? 1.5)}{" "}
              + تنبيه×
              {toDisplayDigits(
                penalties.find((p) => p.kind === "TANBIH")?.weight ?? 0.75,
              )}{" "}
              + تلعثم×
              {toDisplayDigits(
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
              إلغاء السؤال تلقائيًا
            </h2>
            <p className="mb-4 font-body-md text-sm text-on-surface-variant">
              اختياري: إلغاء السؤال مباشرةً إذا سُجِّل أيّ خطأ (فتح، تنبيه، أو
              تلعثم) بعد بلوغ عدد الفتحات الحدّ المحدَّد. هذا الإعداد مستقلّ عن
              بقية المعايير — يبقى قابلًا للتعديل حتى بعد اعتماد نتائج، لأنّه
              لا يُغيّر أي سؤال سبق تقييمه واعتماده.
            </p>
            {autoCancelError ? (
              <div className="mb-3">
                <Banner tone="error" onDismiss={() => setAutoCancelError(null)}>
                  {autoCancelError}
                </Banner>
              </div>
            ) : null}
            {autoCancelSuccess ? (
              <div className="mb-3">
                <Banner
                  tone="success"
                  onDismiss={() => setAutoCancelSuccess(null)}
                >
                  {autoCancelSuccess}
                </Banner>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 font-body-md text-sm text-on-surface">
                <input
                  type="checkbox"
                  checked={autoCancelEnabled}
                  onChange={(e) => setAutoCancelEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-outline-variant"
                />
                تفعيل الإلغاء التلقائي
              </label>
              {autoCancelEnabled ? (
                <div className="flex items-center gap-2">
                  <span className="font-label-md text-sm text-on-surface-variant">
                    بعد الفتح رقم
                  </span>
                  <Input
                    type="number"
                    min={1}
                    step="1"
                    value={autoCancelThreshold}
                    onChange={(e) =>
                      setAutoCancelThreshold(
                        Math.max(1, Number(e.target.value)),
                      )
                    }
                    className="w-20"
                  />
                </div>
              ) : null}
            </div>
            {autoCancelEnabled ? (
              <p className="mt-3 rounded-lg bg-surface-container-low p-3 font-arabic-body text-sm text-on-surface-variant">
                {autoCancelMessage(autoCancelThreshold)}
              </p>
            ) : null}
            <Button
              className="mt-4"
              icon="save"
              loading={updateAutoCancel.isPending}
              onClick={submitAutoCancel}
            >
              حفظ إعداد الإلغاء التلقائي
            </Button>
          </Card>

          <Card className="p-6">
            <h2 className="mb-1 font-headline-md text-lg text-on-surface">
              المعايير العامّة
            </h2>
            <p className="mb-4 font-body-md text-sm text-on-surface-variant">
              معايير تُقيَّم مرّة واحدة بعد آخر سؤال (التجويد، الصوت) بقيمة قصوى
              لكل منها. أمّا معايير الحفظ الخاصّة فتُرصد لكلّ سؤال على حدة.
            </p>
            {directs.length === 0 ? (
              <p className="font-body-md text-sm text-on-surface-variant">
                لا توجد معايير مباشرة.
              </p>
            ) : (
              <div className="space-y-4">
                <p className="rounded-lg bg-surface-container-low p-3 font-body-md text-xs text-on-surface-variant">
                  لكلّ معيار تجويد سلالم مرتبطة بعدد أحزاب المشارك؛ يُختار السلّم
                  الذي يقع فيه عدد أحزابه، وتحدّد نطاقاته (الشرائح) الوصفية سقف
                  الدرجة. معيار له سلالم لا يظهر للمحكّم إلا للأصناف الواقعة ضمن
                  نطاق أحد سلالمه — الأصناف الأخرى لا تُقيَّم بهذا المعيار
                  إطلاقًا، ما يتيح استعمال معايير مختلفة كليًّا لفئات مختلفة من
                  الأصناف داخل المسابقة نفسها.
                </p>
                {directs.map((direct, index) => (
                  <div
                    key={direct.key}
                    className="flex flex-col gap-3 rounded-lg border border-outline-variant p-3"
                  >
                    <div className="flex flex-wrap items-end gap-3">
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

                    <div className="flex flex-col gap-3 border-t border-outline-variant pt-3">
                      <div className="flex items-center justify-between">
                        <span className="font-label-md text-xs font-medium text-on-surface-variant">
                          السلالم (حسب عدد الأحزاب)
                        </span>
                        <Button
                          variant="outline"
                          icon="add"
                          disabled={locked}
                          onClick={() => addScale(index)}
                        >
                          سلّم
                        </Button>
                      </div>

                      {direct.scales.length === 0 ? (
                        <p className="font-body-md text-xs text-on-surface-variant">
                          لا توجد سلالم — تُطبَّق القيمة القصوى مباشرة على جميع
                          الأصناف.
                        </p>
                      ) : (
                        direct.scales.map((scale, sIndex) => (
                          <div
                            key={sIndex}
                            className="flex flex-col gap-3 rounded-lg bg-surface-container-low p-3"
                          >
                            <div className="flex flex-wrap items-end gap-2">
                              <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
                                <label className="font-label-md text-xs text-on-surface-variant">
                                  اسم السلّم
                                </label>
                                <Input
                                  disabled={locked}
                                  value={scale.labelAr}
                                  onChange={(e) =>
                                    updateScale(index, sIndex, {
                                      labelAr: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="flex w-24 flex-col gap-1.5">
                                <label className="font-label-md text-xs text-on-surface-variant">
                                  من حزب
                                </label>
                                <Input
                                  type="number"
                                  min={1}
                                  disabled={locked}
                                  value={scale.minHizb}
                                  onChange={(e) =>
                                    updateScale(index, sIndex, {
                                      minHizb: Number(e.target.value),
                                    })
                                  }
                                />
                              </div>
                              <div className="flex w-24 flex-col gap-1.5">
                                <label className="font-label-md text-xs text-on-surface-variant">
                                  إلى حزب
                                </label>
                                <Input
                                  type="number"
                                  min={1}
                                  disabled={locked}
                                  value={scale.maxHizb}
                                  onChange={(e) =>
                                    updateScale(index, sIndex, {
                                      maxHizb: Number(e.target.value),
                                    })
                                  }
                                />
                              </div>
                              <div className="flex w-24 flex-col gap-1.5">
                                <label className="font-label-md text-xs text-on-surface-variant">
                                  القصوى
                                </label>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.5"
                                  disabled={locked}
                                  value={scale.maxPoints}
                                  onChange={(e) =>
                                    updateScale(index, sIndex, {
                                      maxPoints: Number(e.target.value),
                                    })
                                  }
                                />
                              </div>
                              <Button
                                variant="ghost"
                                icon="delete"
                                disabled={locked}
                                onClick={() => removeScale(index, sIndex)}
                              >
                                حذف
                              </Button>
                            </div>

                            <div className="flex flex-col gap-2 border-t border-outline-variant pt-2">
                              <div className="flex items-center justify-between">
                                <span className="font-label-md text-xs text-on-surface-variant">
                                  الشرائح الوصفية
                                </span>
                                <Button
                                  variant="ghost"
                                  icon="add"
                                  disabled={locked}
                                  onClick={() => addBand(index, sIndex)}
                                >
                                  شريحة
                                </Button>
                              </div>
                              {scale.bands.length === 0 ? (
                                <p className="font-body-md text-xs text-on-surface-variant">
                                  لا توجد شرائح.
                                </p>
                              ) : (
                                scale.bands.map((band, bIndex) => (
                                  <div
                                    key={bIndex}
                                    className="flex flex-wrap items-start gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest p-2"
                                  >
                                    <div className="flex w-20 flex-col gap-1">
                                      <label className="font-label-md text-[11px] text-on-surface-variant">
                                        من
                                      </label>
                                      <Input
                                        type="number"
                                        step="0.5"
                                        disabled={locked}
                                        value={band.minPoints}
                                        onChange={(e) =>
                                          updateBand(index, sIndex, bIndex, {
                                            minPoints: Number(e.target.value),
                                          })
                                        }
                                      />
                                    </div>
                                    <div className="flex w-20 flex-col gap-1">
                                      <label className="font-label-md text-[11px] text-on-surface-variant">
                                        إلى
                                      </label>
                                      <Input
                                        type="number"
                                        step="0.5"
                                        disabled={locked}
                                        value={band.maxPoints}
                                        onChange={(e) =>
                                          updateBand(index, sIndex, bIndex, {
                                            maxPoints: Number(e.target.value),
                                          })
                                        }
                                      />
                                    </div>
                                    <div className="flex min-w-[180px] flex-1 flex-col gap-1">
                                      <label className="font-label-md text-[11px] text-on-surface-variant">
                                        الوصف
                                      </label>
                                      <Textarea
                                        rows={2}
                                        disabled={locked}
                                        value={band.descriptionAr}
                                        onChange={(e) =>
                                          updateBand(index, sIndex, bIndex, {
                                            descriptionAr: e.target.value,
                                          })
                                        }
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      disabled={locked}
                                      onClick={() =>
                                        removeBand(index, sIndex, bIndex)
                                      }
                                      className="mt-5 rounded-full p-1 text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
                                      aria-label="حذف الشريحة"
                                    >
                                      <Icon name="close" className="text-[18px]" />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ))
                      )}
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
                  مجموع المعايير العامّة
                </span>
                <span className="text-on-surface" dir="ltr">
                  {round2(directTotal)}
                </span>
              </div>
              <div className="my-2 border-t border-outline-variant" />
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-on-surface">الإجمالي</span>
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  disabled={locked}
                  value={total}
                  onChange={(e) => handleTotalChange(Number(e.target.value))}
                  className="w-24 text-left font-headline-md text-lg text-primary"
                  dir="ltr"
                />
              </div>
              <p className="font-body-md text-xs text-on-surface-variant">
                تعديل الإجمالي أو المعايير العامّة يُحدّث أساس الحفظ تلقائيًا
                للحفاظ على الدرجة الكلّية.
              </p>
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
