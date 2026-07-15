import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toDisplayDigits } from "@tahkeem/shared";
import { useCandidateReport, useCompetition, useResults } from "../hooks";
import { useSelectedCompetition } from "../lib/competitionContext";
import { apiErrorMessage } from "../lib/api";
import { GENDER_LABELS } from "../lib/labels";
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  ErrorState,
  Icon,
  Select,
  Skeleton,
} from "../components/ui";
import type { CandidateReport } from "../types";

const MEDALS = ["#f6c945", "#c4c7c3", "#cd8a4b"];

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${toDisplayDigits(minutes)} د`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0
    ? `${toDisplayDigits(hours)} س`
    : `${toDisplayDigits(hours)} س ${toDisplayDigits(rest)} د`;
}

/** The two tables shared by the on-screen drawer and the printed card. */
function CandidateReportBody({ report }: { report: CandidateReport }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="font-headline-md text-xl text-on-surface">
          {report.candidate.fullName}
        </h3>
        <p className="mt-1 font-body-md text-sm text-on-surface-variant">
          {GENDER_LABELS[report.candidate.gender]} ·{" "}
          {report.candidate.category.labelAr}
          {report.candidate.teacherName
            ? ` · المعلّم: ${report.candidate.teacherName}`
            : ""}
        </p>
        {report.judges.length > 0 ? (
          <div className="mt-2 flex flex-col gap-1">
            {report.judges.map((j) => (
              <p
                key={j.id}
                className="font-body-md text-sm text-on-surface-variant"
              >
                <Icon
                  name="how_to_reg"
                  className="me-1 align-middle text-[16px]"
                />
                {j.fullName}
                <span className="ms-2 font-body-md text-xs text-on-surface-variant">
                  · مدّة التّقييم: {formatDuration(j.durationMinutes)}
                </span>
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-2 font-body-md text-sm text-on-surface-variant">
            لم يُقيَّم بعد.
          </p>
        )}
      </div>

      <section>
        <h4 className="mb-2 font-label-md text-sm font-medium text-on-surface-variant">
          الحفظ — الأسئلة
        </h4>
        <div className="overflow-hidden rounded-lg border border-outline-variant">
          <table className="w-full border-collapse text-start text-sm">
            <thead>
              <tr className="bg-surface-container text-start font-label-md text-xs text-on-surface-variant">
                <th className="px-3 py-2 text-start font-medium">السّؤال</th>
                <th className="px-3 py-2 text-start font-medium">النتيجة</th>
              </tr>
            </thead>
            <tbody>
              {report.questions.map((q, i) => (
                <tr key={q.id} className="border-t border-outline-variant/60">
                  <td className="px-3 py-2 font-arabic-body text-on-surface">
                    {toDisplayDigits(i + 1)}. {q.label}
                  </td>
                  <td className="px-3 py-2 text-on-surface" dir="ltr">
                    {q.averageScore === null
                      ? "—"
                      : `${q.averageScore.toFixed(2)} / ${q.maxScore.toFixed(2)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h4 className="mb-2 font-label-md text-sm font-medium text-on-surface-variant">
          المعايير العامّة للتقييم
        </h4>
        <div className="overflow-hidden rounded-lg border border-outline-variant">
          <table className="w-full border-collapse text-start text-sm">
            <thead>
              <tr className="bg-surface-container text-start font-label-md text-xs text-on-surface-variant">
                <th className="px-3 py-2 text-start font-medium">المعيار</th>
                <th className="px-3 py-2 text-start font-medium">النتيجة</th>
              </tr>
            </thead>
            <tbody>
              {report.criteria.map((c) => (
                <tr key={c.id} className="border-t border-outline-variant/60">
                  <td className="px-3 py-2 text-on-surface">{c.labelAr}</td>
                  <td className="px-3 py-2 text-on-surface" dir="ltr">
                    {c.averageValue === null
                      ? "—"
                      : `${c.averageValue.toFixed(2)} / ${c.maxPoints.toFixed(2)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {report.notes.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2">
            {report.notes.map((n, i) => (
              <p
                key={i}
                className="rounded-lg border border-outline-variant bg-surface-container/50 px-3 py-2 font-body-md text-sm text-on-surface"
              >
                <span className="font-medium">{n.judge.fullName}:</span>{" "}
                {n.notes}
              </p>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between rounded-xl border-2 border-primary bg-primary-container/10 px-4 py-3">
          <span className="font-label-md text-sm font-medium text-on-surface">
            النّتيجة النّهائيّة
          </span>
          <span className="font-headline-lg text-2xl text-primary" dir="ltr">
            {report.finalScoreOn20.toFixed(2)} / 20
          </span>
        </div>
      </section>
    </div>
  );
}

function CandidateReportDrawer({
  candidateId,
  onClose,
}: {
  candidateId: string | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError, error, refetch } = useCandidateReport(
    candidateId ?? undefined,
  );

  return (
    <Drawer open={candidateId !== null} onClose={onClose} title="بطاقة النتيجة">
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : isError || !data ? (
        <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />
      ) : (
        <CandidateReportBody report={data} />
      )}
    </Drawer>
  );
}

/** Portals the printable card to <body>, prints it once loaded, then reports back. */
function CandidateReportPrint({
  candidateId,
  onDone,
}: {
  candidateId: string;
  onDone: () => void;
}) {
  const { data } = useCandidateReport(candidateId);
  const printed = useRef(false);

  useEffect(() => {
    if (!data || printed.current) return;
    printed.current = true;
    window.addEventListener("afterprint", onDone, { once: true });
    const id = window.setTimeout(() => window.print(), 50);
    return () => window.clearTimeout(id);
  }, [data, onDone]);

  if (!data) return null;

  return createPortal(
    <div className="print-only" dir="rtl">
      <div style={{ textAlign: "center", fontFamily: "Amiri, serif", color: "#1b1c1c" }}>
        <img
          src="/logo-omar.png"
          alt=""
          style={{ width: "20mm", height: "20mm", borderRadius: "50%" }}
        />
        <p style={{ fontSize: "11pt", margin: "2mm 0 0" }}>
          جمعية عمر بن الخطاب — دار شعبان الفهري
        </p>
        <p style={{ fontSize: "13pt", fontWeight: 700, margin: "1mm 0 6mm" }}>
          {data.competition.name}
        </p>
      </div>
      <div style={{ fontFamily: "'Work Sans', sans-serif" }}>
        <CandidateReportBody report={data} />
      </div>
    </div>,
    document.body,
  );
}

export function ResultsPage() {
  const { selectedId } = useSelectedCompetition();
  const competition = useCompetition(selectedId ?? undefined);
  const [categoryId, setCategoryId] = useState("");
  const results = useResults(selectedId ?? undefined, categoryId);
  const [viewId, setViewId] = useState<string | null>(null);
  const [printId, setPrintId] = useState<string | null>(null);

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
                  <th className="px-4 py-3 text-end font-medium">إجراءات</th>
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
                          {toDisplayDigits(index + 1)}
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
                      {toDisplayDigits(row.judgeCount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="font-headline-md text-lg text-primary"
                        dir="ltr"
                      >
                        {row.averageScore.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          icon="visibility"
                          onClick={() => setViewId(row.candidate.id)}
                        >
                          الاطّلاع
                        </Button>
                        <Button
                          variant="ghost"
                          icon="print"
                          disabled={printId === row.candidate.id}
                          onClick={() => setPrintId(row.candidate.id)}
                        >
                          طباعة
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CandidateReportDrawer candidateId={viewId} onClose={() => setViewId(null)} />
      {printId ? (
        <CandidateReportPrint
          candidateId={printId}
          onDone={() => setPrintId(null)}
        />
      ) : null}
    </div>
  );
}
