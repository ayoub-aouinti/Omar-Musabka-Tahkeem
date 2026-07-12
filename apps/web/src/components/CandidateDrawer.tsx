import { useNavigate } from "react-router-dom";
import { toDisplayDigits } from "@tahkeem/shared";
import {
  useCandidate,
  useCandidateJudges,
  useGenerateCandidateQuestions,
  useJudges,
  useSetCandidateJudges,
} from "../hooks";
import { apiErrorMessage } from "../lib/api";
import { useDebounce } from "../lib/useDebounce";
import { GENDER_LABELS, formatAmount } from "../lib/labels";
import {
  Banner,
  Button,
  Chip,
  Drawer,
  ErrorState,
  Icon,
  Input,
  Skeleton,
} from "./ui";
import { ScopeSummary } from "./ScopeSummary";
import { useEffect, useMemo, useState } from "react";

/** «المحكّمون المعيّنون» — set the candidate's overriding judges. */
function JudgeAssignment({ candidateId }: { candidateId: string }) {
  const assigned = useCandidateJudges(candidateId);
  const setJudges = useSetCandidateJudges(candidateId);
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search);
  const judges = useJudges(debounced);
  const [selected, setSelected] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Seed the selection from the candidate's current direct judges.
  useEffect(() => {
    if (assigned.data) setSelected(assigned.data.map((j) => j.id));
  }, [assigned.data]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function toggle(id: string) {
    setSelected((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
    );
  }

  async function save() {
    setFeedback(null);
    try {
      const next = await setJudges.mutateAsync(selected);
      setFeedback(
        next.length === 0
          ? "أُعيد فتح المشارك لجميع محكّمي صنفه."
          : `تم تعيين ${toDisplayDigits(next.length)} محكّمًا.`,
      );
    } catch (err) {
      setFeedback(apiErrorMessage(err));
    }
  }

  return (
    <section className="rounded-xl border border-outline-variant p-4">
      <div className="mb-2 flex items-center gap-2 text-on-surface-variant">
        <Icon name="how_to_reg" className="text-[20px]" />
        <h4 className="font-label-md text-sm font-medium">المحكّمون المعيّنون</h4>
      </div>
      <p className="mb-3 font-body-md text-xs text-on-surface-variant">
        عند تعيين محكّم أو أكثر، لا يُقيّم هذا المشارك إلّا هؤلاء المحكّمون. اترك
        القائمة فارغة ليبقى مفتوحًا لجميع محكّمي صنفه.
      </p>

      {feedback ? (
        <div className="mb-3">
          <Banner tone="info" onDismiss={() => setFeedback(null)}>
            {feedback}
          </Banner>
        </div>
      ) : null}

      {assigned.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Icon
              name="search"
              className="pointer-events-none absolute inset-y-0 end-3 my-auto text-[20px] text-on-surface-variant"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن محكّم…"
              className="w-full pe-10"
            />
          </div>

          <div className="max-h-56 overflow-auto rounded-lg border border-outline-variant">
            {judges.isLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : !judges.data || judges.data.length === 0 ? (
              <p className="p-4 text-center font-body-md text-sm text-on-surface-variant">
                لا يوجد محكّمون مطابقون.
              </p>
            ) : (
              <ul>
                {judges.data.map((judge) => (
                  <li key={judge.id}>
                    <label className="flex cursor-pointer items-center gap-3 border-b border-outline-variant/50 px-3 py-2 last:border-b-0 hover:bg-surface-container/50">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(judge.id)}
                        onChange={() => toggle(judge.id)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="font-body-md text-sm text-on-surface">
                        {judge.fullName}
                      </span>
                      <span className="font-body-md text-xs text-on-surface-variant">
                        {GENDER_LABELS[judge.gender]}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Chip className="bg-surface-container-highest text-on-surface-variant">
              {selected.length === 0
                ? "مفتوح للجميع"
                : `${toDisplayDigits(selected.length)} محكّم`}
            </Chip>
            <Button
              icon="save"
              loading={setJudges.isPending}
              onClick={save}
            >
              حفظ التعيين
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

export function CandidateDrawer({
  candidateId,
  onClose,
}: {
  candidateId: string | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useCandidate(
    candidateId ?? undefined,
  );
  const generate = useGenerateCandidateQuestions();
  const [feedback, setFeedback] = useState<string | null>(null);

  async function runGenerate(regenerate: boolean) {
    if (!candidateId) return;
    setFeedback(null);
    try {
      const questions = await generate.mutateAsync({ candidateId, regenerate });
      setFeedback(`تم توليد ${toDisplayDigits(questions.length)} سؤالًا.`);
    } catch (err) {
      setFeedback(apiErrorMessage(err));
    }
  }

  return (
    <Drawer
      open={candidateId !== null}
      onClose={onClose}
      title="بطاقة المشارك"
    >
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : isError || !data ? (
        <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />
      ) : (
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="font-headline-md text-xl text-on-surface">
              {data.fullName}
            </h3>
            <p className="mt-1 font-body-md text-sm text-on-surface-variant">
              {GENDER_LABELS[data.gender]} · {data.category.labelAr}
              {data.teacherName ? ` · المعلّم: ${data.teacherName}` : ""}
            </p>
            {data.externalId ? (
              <p className="font-body-md text-xs text-on-surface-variant">
                الرقم التسلسلي: {data.externalId}
              </p>
            ) : null}
          </div>

          <section className="rounded-xl border border-outline-variant p-4">
            <div className="mb-2 flex items-center gap-2 text-on-surface-variant">
              <Icon name="menu_book" className="text-[20px]" />
              <h4 className="font-label-md text-sm font-medium">
                نطاق الحفظ
              </h4>
            </div>
            <p className="mb-2 font-arabic-body text-base text-on-surface">
              «{data.scopeRaw}»
            </p>
            <ScopeSummary scope={data.scope} />
          </section>

          <JudgeAssignment candidateId={data.id} />

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="font-label-md text-sm font-medium text-on-surface-variant">
                الأسئلة المولّدة ({toDisplayDigits(data.questions.length)})
              </h4>
              <Button
                icon="auto_awesome"
                loading={generate.isPending}
                onClick={() => runGenerate(data.questions.length > 0)}
              >
                {data.questions.length > 0 ? "إعادة التوليد" : "توليد الأسئلة"}
              </Button>
            </div>

            {feedback ? (
              <div className="mb-3">
                <Banner tone="info" onDismiss={() => setFeedback(null)}>
                  {feedback}
                </Banner>
              </div>
            ) : null}

            {data.questions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-outline-variant p-4 text-center font-body-md text-sm text-on-surface-variant">
                لا توجد أسئلة بعد.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.questions.map((q, i) => (
                  <li
                    key={q.id}
                    className="flex items-center justify-between rounded-lg border border-outline-variant px-3 py-2"
                  >
                    <span className="flex items-center gap-2 font-body-md text-sm text-on-surface">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-container/10 text-xs text-primary">
                        {toDisplayDigits(i + 1)}
                      </span>
                      {q.label ?? `آية ${toDisplayDigits(q.startVerseId)}`}
                    </span>
                    <span className="font-body-md text-xs text-on-surface-variant">
                      {formatAmount(q.amountValue, q.amountUnit)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex gap-2 border-t border-outline-variant pt-4">
            <Button
              variant="outline"
              icon="edit"
              onClick={() => navigate(`/candidates/${data.id}/edit`)}
            >
              تعديل البيانات
            </Button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
