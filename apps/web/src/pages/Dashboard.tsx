import { Link, useNavigate } from "react-router-dom";
import { toArabicDigits } from "@tahkeem/shared";
import { useCompetitions, useJudges } from "../hooks";
import { useSelectedCompetition } from "../lib/competitionContext";
import { apiErrorMessage } from "../lib/api";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Icon,
  Skeleton,
} from "../components/ui";
import { STATUS_CHIP, STATUS_LABELS, formatDate } from "../lib/labels";
import type { CompetitionSummary } from "../types";

function StatCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: string;
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-container/10 text-primary">
        <Icon name={icon} className="text-[26px]" />
      </div>
      <div className="min-w-0">
        <p className="font-label-md text-sm text-on-surface-variant">{label}</p>
        {loading ? (
          <Skeleton className="mt-1 h-7 w-16" />
        ) : (
          <p className="font-headline-lg text-2xl text-on-surface">{value}</p>
        )}
      </div>
    </Card>
  );
}

function CompetitionsTable({ items }: { items: CompetitionSummary[] }) {
  const navigate = useNavigate();
  const { setSelectedId } = useSelectedCompetition();

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-start">
        <thead>
          <tr className="border-b border-outline-variant text-start font-label-md text-xs text-on-surface-variant">
            <th className="px-4 py-3 text-start font-medium">المسابقة</th>
            <th className="px-4 py-3 text-start font-medium">المكان</th>
            <th className="px-4 py-3 text-start font-medium">الحالة</th>
            <th className="px-4 py-3 text-start font-medium">المشاركون</th>
            <th className="px-4 py-3 text-start font-medium">الأصناف</th>
            <th className="px-4 py-3 text-start font-medium">تاريخ البدء</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr
              key={c.id}
              onClick={() => {
                setSelectedId(c.id);
                navigate(`/competitions/${c.id}`);
              }}
              className="cursor-pointer border-b border-outline-variant/60 transition-colors hover:bg-surface-container/50"
            >
              <td className="px-4 py-3 font-body-md text-sm font-medium text-on-surface">
                {c.name}
              </td>
              <td className="px-4 py-3 font-body-md text-sm text-on-surface-variant">
                {c.location ?? "—"}
              </td>
              <td className="px-4 py-3">
                <Chip className={STATUS_CHIP[c.status]}>
                  {STATUS_LABELS[c.status]}
                </Chip>
              </td>
              <td className="px-4 py-3 font-body-md text-sm text-on-surface">
                {toArabicDigits(c._count.candidates)}
              </td>
              <td className="px-4 py-3 font-body-md text-sm text-on-surface">
                {toArabicDigits(c._count.categories)}
              </td>
              <td className="px-4 py-3 font-body-md text-sm text-on-surface-variant">
                {formatDate(c.startDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardPage() {
  const competitions = useCompetitions();
  const judges = useJudges("");

  const totalCandidates =
    competitions.data?.reduce((sum, c) => sum + c._count.candidates, 0) ?? 0;
  const activeCompetitions =
    competitions.data?.filter((c) => c.status === "ACTIVE").length ?? 0;

  return (
    <div className="flex flex-col gap-margin-lg">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-3xl text-on-surface">
            لوحة المعلومات
          </h1>
          <p className="mt-1 font-body-md text-sm text-on-surface-variant">
            نظرة عامة على المسابقات والمشاركين والمحكّمين
          </p>
        </div>
        <Link to="/competitions/new">
          <Button icon="add">مسابقة جديدة</Button>
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-gutter-md sm:grid-cols-3">
        <StatCard
          icon="groups"
          label="إجمالي المشاركين"
          value={toArabicDigits(totalCandidates)}
          loading={competitions.isLoading}
        />
        <StatCard
          icon="emoji_events"
          label="المسابقات النشطة"
          value={toArabicDigits(activeCompetitions)}
          loading={competitions.isLoading}
        />
        <StatCard
          icon="gavel"
          label="المحكّمون المعتمدون"
          value={toArabicDigits(judges.data?.length ?? 0)}
          loading={judges.isLoading}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-outline-variant px-container-padding py-4">
          <h2 className="font-headline-md text-lg text-on-surface">المسابقات</h2>
        </div>
        {competitions.isLoading ? (
          <div className="space-y-3 p-container-padding">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : competitions.isError ? (
          <ErrorState
            message={apiErrorMessage(competitions.error)}
            onRetry={() => competitions.refetch()}
          />
        ) : !competitions.data || competitions.data.length === 0 ? (
          <EmptyState
            icon="emoji_events"
            title="لا توجد مسابقات بعد"
            hint="ابدأ بإنشاء أول مسابقة واستيراد ملف المشاركين."
            action={
              <Link to="/competitions/new">
                <Button icon="add">إنشاء مسابقة</Button>
              </Link>
            }
          />
        ) : (
          <CompetitionsTable items={competitions.data} />
        )}
      </Card>
    </div>
  );
}
