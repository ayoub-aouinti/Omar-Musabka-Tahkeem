import { useEffect, useMemo, useState } from "react";
import { toDisplayDigits } from "@tahkeem/shared";
import {
  useCandidates,
  useCompetition,
  useCreateQuestion,
  useDeleteQuestion,
  useQuestionBank,
  useQuestionPassage,
  useQuranVerses,
  useSurahs,
  useUpdateQuestion,
  type QuestionBankFilters,
} from "../hooks";
import { useSelectedCompetition } from "../lib/competitionContext";
import { apiErrorMessage } from "../lib/api";
import {
  AMOUNT_UNITS,
  AMOUNT_UNIT_LABELS,
  DIFFICULTIES,
  DIFFICULTY_CHIP,
  DIFFICULTY_LABELS,
  SOURCES,
  SOURCE_LABELS,
  formatAmount,
} from "../lib/labels";
import {
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  Modal,
  Select,
  Skeleton,
} from "../components/ui";
import { MushafPage } from "../components/MushafPage";
import type {
  AmountUnit,
  BankQuestion,
  Difficulty,
  PassageVerse,
  Surah,
} from "../types";

const PAGE_SIZE = 20;

/** The surah whose verse-id range contains `verseId`, or undefined. */
function surahOfVerse(surahs: Surah[], verseId: number): Surah | undefined {
  return surahs.find(
    (s) => verseId >= s.firstVerseId && verseId <= s.lastVerseId,
  );
}

function refText(q: BankQuestion): string {
  const start = `${q.startRef.surah} ${toDisplayDigits(q.startRef.ayah)}`;
  const end = `${q.endRef.surah} ${toDisplayDigits(q.endRef.ayah)}`;
  return `${start} — ${end}`;
}

/* ----------------------------- shared controls ---------------------------- */

interface Draft {
  surahNumber: number;
  ayah: number;
  amountUnit: AmountUnit;
  amountValue: number;
  difficulty: Difficulty;
}

function DraftControls({
  surahs,
  draft,
  onChange,
  disabled,
}: {
  surahs: Surah[];
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  disabled?: boolean;
}) {
  const surah = surahs.find((s) => s.number === draft.surahNumber);
  const maxAyah = surah?.ayahCount ?? 1;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-label-md text-xs text-on-surface-variant">
            الآية (البداية)
          </span>
          <Input
            type="number"
            min={1}
            max={maxAyah}
            disabled={disabled}
            value={draft.ayah}
            onChange={(e) =>
              onChange({
                ayah: Math.min(
                  Math.max(1, Number(e.target.value) || 1),
                  maxAyah,
                ),
              })
            }
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-label-md text-xs text-on-surface-variant">
            السورة
          </span>
          <Select
            disabled={disabled}
            value={draft.surahNumber}
            onChange={(e) =>
              onChange({ surahNumber: Number(e.target.value), ayah: 1 })
            }
          >
            {surahs.map((s) => (
              <option key={s.number} value={s.number}>
                {toDisplayDigits(s.number)}. {s.nameAr}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-label-md text-xs text-on-surface-variant">
            وحدة المقدار
          </span>
          <Select
            disabled={disabled}
            value={draft.amountUnit}
            onChange={(e) =>
              onChange({ amountUnit: e.target.value as AmountUnit })
            }
          >
            {AMOUNT_UNITS.map((u) => (
              <option key={u} value={u}>
                {AMOUNT_UNIT_LABELS[u]}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-label-md text-xs text-on-surface-variant">
            قيمة المقدار
          </span>
          <Input
            type="number"
            min={1}
            step="0.5"
            disabled={disabled}
            value={draft.amountValue}
            onChange={(e) =>
              onChange({ amountValue: Number(e.target.value) || 1 })
            }
          />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="font-label-md text-xs text-on-surface-variant">
          الصعوبة
        </span>
        <Select
          disabled={disabled}
          value={draft.difficulty}
          onChange={(e) =>
            onChange({ difficulty: e.target.value as Difficulty })
          }
        >
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABELS[d]}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}

/** Resolve a global verse id from a surah + ayah (verse ids are contiguous). */
function resolveVerseId(surah: Surah | undefined, ayah: number): number | null {
  if (!surah) return null;
  const id = surah.firstVerseId + (ayah - 1);
  return id <= surah.lastVerseId ? id : null;
}

/* ---------------------------- edit-question modal ------------------------- */

function EditQuestionModal({
  question,
  onClose,
}: {
  question: BankQuestion;
  onClose: () => void;
}) {
  const surahsQuery = useSurahs();
  const passage = useQuestionPassage(question.id);
  const update = useUpdateQuestion();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const surahs = useMemo(() => surahsQuery.data ?? [], [surahsQuery.data]);

  const [draft, setDraft] = useState<Draft>(() => ({
    surahNumber: 0,
    ayah: question.startRef.ayah,
    amountUnit: question.amountUnit,
    amountValue: question.amountValue,
    difficulty: question.difficulty,
  }));

  // Seed the surah once the surah list resolves, from the question's start id.
  useEffect(() => {
    if (surahs.length === 0) return;
    const s = surahOfVerse(surahs, question.startVerseId);
    setDraft((d) => ({
      ...d,
      surahNumber: s?.number ?? surahs[0].number,
      ayah: s ? question.startVerseId - s.firstVerseId + 1 : 1,
    }));
  }, [surahs, question.startVerseId]);

  const draftSurah = surahs.find((s) => s.number === draft.surahNumber);
  const draftStartId = resolveVerseId(draftSurah, draft.ayah);

  // Recompute the grey wash client-side so it moves live as start/amount change.
  // Span is exact for آيات; for other units we keep the saved verse count.
  const span =
    draft.amountUnit === "ayat"
      ? Math.max(1, Math.round(draft.amountValue))
      : question.verseCount;

  const previewVerses: PassageVerse[] | null = useMemo(() => {
    const pageVerses = passage.data?.page.verses;
    if (!pageVerses || draftStartId == null) return null;
    const endId = draftStartId + span - 1;
    return pageVerses.map((v) => ({
      ...v,
      highlighted: v.id >= draftStartId && v.id <= endId,
    }));
  }, [passage.data, draftStartId, span]);

  async function save() {
    setError(null);
    setSuccess(null);
    if (draftStartId == null) {
      setError("الآية خارج حدود السورة.");
      return;
    }
    try {
      await update.mutateAsync({
        id: question.id,
        payload: {
          startVerseId: draftStartId,
          amountUnit: draft.amountUnit,
          amountValue: draft.amountValue,
          difficulty: draft.difficulty,
        },
      });
      setSuccess("تم حفظ السؤال بنجاح.");
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  const verses = previewVerses ?? passage.data?.page.verses ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      title="تفاصيل السؤال"
      className="max-w-7xl"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        {/* RTL: the mushaf occupies the visual LEFT column. */}
        <div className="order-2 lg:order-1">
          {passage.isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : passage.isError ? (
            <ErrorState
              message={apiErrorMessage(passage.error)}
              onRetry={() => passage.refetch()}
            />
          ) : (
            <MushafPage verses={verses} pages={passage.data?.pages} />
          )}
        </div>

        <div className="order-1 flex flex-col gap-4 lg:order-2">
          {error ? (
            <Banner tone="error" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          ) : null}
          {success ? (
            <Banner tone="success" onDismiss={() => setSuccess(null)}>
              {success}
            </Banner>
          ) : null}

          <div className="rounded-lg border border-outline-variant p-3 font-body-md text-sm text-on-surface-variant">
            {question.candidate ? (
              <span>
                {question.candidate.fullName}
                {question.candidate.externalId
                  ? ` · معرّف ${question.candidate.externalId}`
                  : ""}
              </span>
            ) : (
              <span>بنك الصنف{question.category ? ` · ${question.category.labelAr}` : ""}</span>
            )}
          </div>

          {surahsQuery.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <DraftControls
              surahs={surahs}
              draft={draft}
              onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            />
          )}

          <p className="font-body-md text-xs text-on-surface-variant">
            يُحرَّك التظليل الرمادي فور تغيير الآية أو المقدار. تظهر الصفحة
            النهائية بعد الحفظ.
          </p>

          <div className="flex justify-end gap-2 border-t border-outline-variant pt-4">
            <Button variant="ghost" onClick={onClose}>
              إغلاق
            </Button>
            <Button
              icon="save"
              loading={update.isPending}
              disabled={surahsQuery.isLoading}
              onClick={save}
            >
              حفظ
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------- add-question modal --------------------------- */

function AddQuestionModal({
  competitionId,
  categories,
  onClose,
}: {
  competitionId: string;
  categories: { id: string; labelAr: string }[];
  onClose: () => void;
}) {
  const surahsQuery = useSurahs();
  const create = useCreateQuestion();
  const candidatesQuery = useCandidates(
    { competitionId, take: 200, skip: 0 },
    true,
  );
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<{
    mode: "category" | "candidate";
    categoryId: string;
    candidateId: string;
  }>({ mode: "category", categoryId: "", candidateId: "" });

  const surahs = useMemo(() => surahsQuery.data ?? [], [surahsQuery.data]);
  const [draft, setDraft] = useState<Draft>({
    surahNumber: 0,
    ayah: 1,
    amountUnit: "ayat",
    amountValue: 1,
    difficulty: "MEDIUM",
  });

  useEffect(() => {
    if (surahs.length > 0 && draft.surahNumber === 0) {
      setDraft((d) => ({ ...d, surahNumber: surahs[0].number }));
    }
  }, [surahs, draft.surahNumber]);

  const draftSurah = surahs.find((s) => s.number === draft.surahNumber);
  const startId = resolveVerseId(draftSurah, draft.ayah);

  const span =
    draft.amountUnit === "ayat"
      ? Math.max(1, Math.round(draft.amountValue))
      : 1;
  const previewEnd = startId != null ? startId + span - 1 + 4 : undefined;
  const preview = useQuranVerses(
    startId ?? undefined,
    previewEnd,
  );

  const previewVerses: PassageVerse[] = useMemo(() => {
    if (!preview.data || startId == null) return [];
    const spanEnd = startId + span - 1;
    return preview.data.map((v) => ({
      id: v.id,
      suraNumber: v.suraNumber,
      suraNameAr: v.suraNameAr,
      ayaNumber: v.ayaNumber,
      ayaText: v.ayaText,
      page: v.page,
      jozz: v.jozz,
      hizbNumber: v.hizbNumber,
      highlighted: v.id >= startId && v.id <= spanEnd,
      startsSurah: false,
    }));
  }, [preview.data, startId, span]);

  async function submit() {
    setError(null);
    if (startId == null) {
      setError("الآية خارج حدود السورة.");
      return;
    }
    try {
      await create.mutateAsync({
        competitionId,
        categoryId:
          target.mode === "category" ? target.categoryId || undefined : undefined,
        candidateId:
          target.mode === "candidate"
            ? target.candidateId || undefined
            : undefined,
        startVerseId: startId,
        amountUnit: draft.amountUnit,
        amountValue: draft.amountValue,
        difficulty: draft.difficulty,
      });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  const canSubmit =
    startId != null &&
    (target.mode === "category"
      ? Boolean(target.categoryId)
      : Boolean(target.candidateId));

  return (
    <Modal open onClose={onClose} title="إضافة سؤال" className="max-w-7xl">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="order-2 lg:order-1">
          {preview.isFetching ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <MushafPage verses={previewVerses} />
          )}
        </div>

        <div className="order-1 flex flex-col gap-4 lg:order-2">
          {error ? (
            <Banner tone="error" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <span className="font-label-md text-xs text-on-surface-variant">
              الوجهة
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTarget((t) => ({ ...t, mode: "category" }))}
                className={[
                  "flex-1 rounded-full border px-3 py-2 font-label-md text-sm transition-colors",
                  target.mode === "category"
                    ? "border-primary bg-primary text-on-primary"
                    : "border-outline text-on-surface hover:bg-surface-container",
                ].join(" ")}
              >
                بنك الصنف
              </button>
              <button
                type="button"
                onClick={() => setTarget((t) => ({ ...t, mode: "candidate" }))}
                className={[
                  "flex-1 rounded-full border px-3 py-2 font-label-md text-sm transition-colors",
                  target.mode === "candidate"
                    ? "border-primary bg-primary text-on-primary"
                    : "border-outline text-on-surface hover:bg-surface-container",
                ].join(" ")}
              >
                مشارك بعينه
              </button>
            </div>
          </div>

          {target.mode === "category" ? (
            <label className="flex flex-col gap-1.5">
              <span className="font-label-md text-xs text-on-surface-variant">
                الصنف
              </span>
              <Select
                value={target.categoryId}
                onChange={(e) =>
                  setTarget((t) => ({ ...t, categoryId: e.target.value }))
                }
              >
                <option value="">— اختر —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.labelAr}
                  </option>
                ))}
              </Select>
            </label>
          ) : (
            <label className="flex flex-col gap-1.5">
              <span className="font-label-md text-xs text-on-surface-variant">
                المشارك
              </span>
              <Select
                value={target.candidateId}
                onChange={(e) =>
                  setTarget((t) => ({ ...t, candidateId: e.target.value }))
                }
              >
                <option value="">— اختر —</option>
                {candidatesQuery.data?.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                    {c.externalId ? ` (${c.externalId})` : ""}
                  </option>
                ))}
              </Select>
            </label>
          )}

          {surahsQuery.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <DraftControls
              surahs={surahs}
              draft={draft}
              onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            />
          )}

          <div className="flex justify-end gap-2 border-t border-outline-variant pt-4">
            <Button variant="ghost" onClick={onClose}>
              إلغاء
            </Button>
            <Button
              icon="add"
              loading={create.isPending}
              disabled={!canSubmit}
              onClick={submit}
            >
              إضافة السؤال
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------------- page ----------------------------------- */

export function QuestionsPage() {
  const { selectedId } = useSelectedCompetition();
  const competition = useCompetition(selectedId ?? undefined);
  const del = useDeleteQuestion();

  const [categoryId, setCategoryId] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<BankQuestion | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidatesQuery = useCandidates(
    { competitionId: selectedId ?? undefined, categoryId: categoryId || undefined, take: 200, skip: 0 },
    Boolean(selectedId),
  );

  const filters = useMemo<QuestionBankFilters>(
    () => ({
      competitionId: selectedId ?? undefined,
      categoryId: categoryId || undefined,
      candidateId: candidateId || undefined,
      difficulty: difficulty || undefined,
      source: source || undefined,
      take: PAGE_SIZE,
      skip: page * PAGE_SIZE,
    }),
    [selectedId, categoryId, candidateId, difficulty, source, page],
  );

  const bank = useQuestionBank(filters, Boolean(selectedId));
  const total = bank.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function remove(q: BankQuestion) {
    setError(null);
    try {
      await del.mutateAsync(q.id);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  if (!selectedId) {
    return (
      <EmptyState
        icon="quiz"
        title="اختر مسابقة أولًا"
        hint="حدّد المسابقة من القائمة الجانبية لعرض بنك الأسئلة."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-3xl text-on-surface">
            بنك الأسئلة
          </h1>
          <p className="mt-1 font-body-md text-sm text-on-surface-variant">
            {toDisplayDigits(total)} سؤال في{" "}
            {competition.data?.name ?? "المسابقة"}
          </p>
        </div>
        <Button icon="add" onClick={() => setAdding(true)}>
          إضافة سؤال
        </Button>
      </header>

      {error ? (
        <Banner tone="error" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      ) : null}

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="mb-1.5 block font-label-md text-xs text-on-surface-variant">
            الصنف
          </label>
          <Select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setCandidateId("");
              setPage(0);
            }}
          >
            <option value="">كل الأصناف</option>
            {competition.data?.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.labelAr}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block font-label-md text-xs text-on-surface-variant">
            المشارك
          </label>
          <Select
            value={candidateId}
            onChange={(e) => {
              setCandidateId(e.target.value);
              setPage(0);
            }}
          >
            <option value="">كل المشاركين</option>
            {candidatesQuery.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block font-label-md text-xs text-on-surface-variant">
            الصعوبة
          </label>
          <Select
            value={difficulty}
            onChange={(e) => {
              setDifficulty(e.target.value);
              setPage(0);
            }}
          >
            <option value="">الكل</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABELS[d]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block font-label-md text-xs text-on-surface-variant">
            المصدر
          </label>
          <Select
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setPage(0);
            }}
          >
            <option value="">الكل</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {bank.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : bank.isError ? (
          <ErrorState
            message={apiErrorMessage(bank.error)}
            onRetry={() => bank.refetch()}
          />
        ) : !bank.data || bank.data.items.length === 0 ? (
          <EmptyState
            icon="quiz"
            title="لا توجد أسئلة مطابقة"
            hint="جرّب تغيير المرشّحات أو أضف سؤالًا يدويًا."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-outline-variant text-start font-label-md text-xs text-on-surface-variant">
                  <th className="px-4 py-3 text-start font-medium">الوجهة</th>
                  <th className="px-4 py-3 text-start font-medium">الصنف</th>
                  <th className="px-4 py-3 text-start font-medium">المدى</th>
                  <th className="px-4 py-3 text-start font-medium">الآيات</th>
                  <th className="px-4 py-3 text-start font-medium">المقدار</th>
                  <th className="px-4 py-3 text-start font-medium">الصعوبة</th>
                  <th className="px-4 py-3 text-end font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {bank.data.items.map((q) => (
                  <tr
                    key={q.id}
                    onClick={() => setEditing(q)}
                    className="cursor-pointer border-b border-outline-variant/60 transition-colors hover:bg-surface-container/50"
                  >
                    <td className="px-4 py-3 font-body-md text-sm font-medium text-on-surface">
                      {q.candidate ? (
                        <span>
                          {q.candidate.fullName}
                          {q.candidate.externalId ? (
                            <span className="text-on-surface-variant">
                              {" "}
                              · {q.candidate.externalId}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-on-surface-variant">
                          بنك الصنف
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-body-md text-sm text-on-surface-variant">
                      {q.category?.labelAr ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-arabic-body text-sm text-on-surface">
                      {refText(q)}
                    </td>
                    <td className="px-4 py-3 font-body-md text-sm text-on-surface-variant">
                      {toDisplayDigits(q.verseCount)}
                    </td>
                    <td className="px-4 py-3 font-body-md text-sm text-on-surface-variant">
                      {formatAmount(q.amountValue, q.amountUnit)}
                    </td>
                    <td className="px-4 py-3">
                      <Chip className={DIFFICULTY_CHIP[q.difficulty]}>
                        {DIFFICULTY_LABELS[q.difficulty]}
                      </Chip>
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          icon="edit"
                          onClick={() => setEditing(q)}
                        >
                          تعديل
                        </Button>
                        <Button
                          variant="ghost"
                          icon="delete"
                          onClick={() => remove(q)}
                        >
                          حذف
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE ? (
          <div className="flex items-center justify-between border-t border-outline-variant px-4 py-3">
            <span className="font-body-md text-sm text-on-surface-variant">
              صفحة {toDisplayDigits(page + 1)} من {toDisplayDigits(pageCount)}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                icon="chevron_right"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                السابق
              </Button>
              <Button
                variant="outline"
                disabled={page + 1 >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                التالي
                <Icon name="chevron_left" className="text-[20px]" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      {editing ? (
        <EditQuestionModal
          question={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {adding ? (
        <AddQuestionModal
          competitionId={selectedId}
          categories={competition.data?.categories ?? []}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </div>
  );
}
