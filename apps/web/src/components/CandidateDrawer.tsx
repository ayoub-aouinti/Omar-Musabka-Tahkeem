import { useNavigate } from "react-router-dom";
import { toDisplayDigits } from "@tahkeem/shared";
import { useCandidate, useGenerateCandidateQuestions } from "../hooks";
import { apiErrorMessage } from "../lib/api";
import { GENDER_LABELS, formatAmount } from "../lib/labels";
import { Banner, Button, Drawer, ErrorState, Icon, Skeleton } from "./ui";
import { ScopeSummary } from "./ScopeSummary";
import { useState } from "react";

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
