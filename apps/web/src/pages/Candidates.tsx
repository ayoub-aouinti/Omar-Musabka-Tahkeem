import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toDisplayDigits } from "@tahkeem/shared";
import {
  useBulkAssignJudge,
  useCandidates,
  useCompetition,
  useJudges,
  type CandidateFilters,
} from "../hooks";
import { useSelectedCompetition } from "../lib/competitionContext";
import { useDebounce } from "../lib/useDebounce";
import { apiErrorMessage } from "../lib/api";
import { GENDER_LABELS, JUDGING_STATUS_LABELS } from "../lib/labels";
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
import { CandidateDrawer } from "../components/CandidateDrawer";
import type { CandidateListItem } from "../types";

const PAGE_SIZE = 20;

function judgingChip(candidate: CandidateListItem) {
  const submitted = candidate.judgingSessions.filter(
    (s) => s.status === "SUBMITTED",
  ).length;
  const total = candidate.judgingSessions.length;
  if (total === 0) {
    return (
      <Chip className="bg-surface-container-highest text-on-surface-variant">
        لم يبدأ
      </Chip>
    );
  }
  const label =
    submitted === total
      ? JUDGING_STATUS_LABELS.SUBMITTED
      : `${toDisplayDigits(submitted)}/${toDisplayDigits(total)} معتمد`;
  return (
    <Chip
      className={
        submitted === total
          ? "bg-primary-container text-on-primary"
          : "bg-secondary-container text-on-secondary-container"
      }
    >
      {label}
    </Chip>
  );
}

function BulkAssignModal({
  candidateIds,
  onClose,
  onDone,
}: {
  candidateIds: string[];
  onClose: () => void;
  onDone: (assigned: number) => void;
}) {
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search);
  const judges = useJudges(debounced);
  const assign = useBulkAssignJudge();
  const [judgeId, setJudgeId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!judgeId) return;
    setError(null);
    try {
      const res = await assign.mutateAsync({ judgeId, candidateIds });
      onDone(res.assigned);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <Modal open onClose={onClose} title="إسناد محكّم" className="max-w-md">
      <div className="flex flex-col gap-4">
        {error ? (
          <Banner tone="error" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        ) : null}
        <p className="font-body-md text-sm text-on-surface-variant">
          سيُسنَد المحكّم المختار إلى {toDisplayDigits(candidateIds.length)}{" "}
          مشاركًا، فلا يُقيّمهم غيره.
        </p>
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
        <div className="max-h-60 overflow-auto rounded-lg border border-outline-variant">
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
                      type="radio"
                      name="bulk-judge"
                      checked={judgeId === judge.id}
                      onChange={() => setJudgeId(judge.id)}
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
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            icon="how_to_reg"
            loading={assign.isPending}
            disabled={!judgeId}
            onClick={submit}
          >
            إسناد
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function CandidatesPage() {
  const { selectedId } = useSelectedCompetition();
  const competition = useCompetition(selectedId ?? undefined);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [gender, setGender] = useState("");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search);

  const filters = useMemo<CandidateFilters>(
    () => ({
      competitionId: selectedId ?? undefined,
      categoryId: categoryId || undefined,
      gender: gender || undefined,
      search: debouncedSearch || undefined,
      take: PAGE_SIZE,
      skip: page * PAGE_SIZE,
    }),
    [selectedId, categoryId, gender, debouncedSearch, page],
  );

  const candidates = useCandidates(filters, Boolean(selectedId));

  const total = candidates.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const items = candidates.data?.items ?? [];
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const allOnPageSelected =
    items.length > 0 && items.every((c) => selectedSet.has(c.id));

  function toggleSelect(id: string) {
    setSelected((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
    );
  }

  function toggleSelectAll() {
    if (allOnPageSelected) {
      setSelected((list) => list.filter((id) => !items.some((c) => c.id === id)));
    } else {
      setSelected((list) => [
        ...list,
        ...items.filter((c) => !list.includes(c.id)).map((c) => c.id),
      ]);
    }
  }

  if (!selectedId) {
    return (
      <EmptyState
        icon="emoji_events"
        title="اختر مسابقة أولًا"
        hint="حدّد المسابقة من القائمة الجانبية لعرض مشاركيها."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-3xl text-on-surface">المشاركون</h1>
          <p className="mt-1 font-body-md text-sm text-on-surface-variant">
            {toDisplayDigits(total)} مشارك في {competition.data?.name ?? "المسابقة"}
          </p>
        </div>
        <Link to="/candidates/new">
          <Button icon="person_add">مشارك جديد</Button>
        </Link>
      </header>

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1.5 block font-label-md text-xs text-on-surface-variant">
            بحث بالاسم
          </label>
          <div className="relative">
            <Icon
              name="search"
              className="pointer-events-none absolute inset-y-0 end-3 my-auto text-[20px] text-on-surface-variant"
            />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="اكتب اسم المشارك…"
              className="w-full pe-10"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block font-label-md text-xs text-on-surface-variant">
            الصنف
          </label>
          <Select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
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
            الجنس
          </label>
          <Select
            value={gender}
            onChange={(e) => {
              setGender(e.target.value);
              setPage(0);
            }}
          >
            <option value="">الكل</option>
            <option value="MALE">{GENDER_LABELS.MALE}</option>
            <option value="FEMALE">{GENDER_LABELS.FEMALE}</option>
          </Select>
        </div>
      </Card>

      {notice ? (
        <Banner tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Banner>
      ) : null}

      {selected.length > 0 ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
          <span className="font-body-md text-sm text-on-surface">
            {toDisplayDigits(selected.length)} مشارك محدَّد
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setSelected([])}>
              إلغاء التحديد
            </Button>
            <Button icon="how_to_reg" onClick={() => setBulkOpen(true)}>
              إسناد محكّم
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        {candidates.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : candidates.isError ? (
          <ErrorState
            message={apiErrorMessage(candidates.error)}
            onRetry={() => candidates.refetch()}
          />
        ) : !candidates.data || candidates.data.items.length === 0 ? (
          <EmptyState
            icon="person_search"
            title="لا يوجد مشاركون مطابقون"
            hint="جرّب تغيير كلمات البحث أو المرشّحات."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-outline-variant text-start font-label-md text-xs text-on-surface-variant">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="تحديد كل المشاركين في الصفحة"
                      checked={allOnPageSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 accent-primary"
                    />
                  </th>
                  <th className="px-4 py-3 text-start font-medium">الاسم</th>
                  <th className="px-4 py-3 text-start font-medium">الصنف</th>
                  <th className="px-4 py-3 text-start font-medium">الجنس</th>
                  <th className="px-4 py-3 text-start font-medium">نطاق الحفظ</th>
                  <th className="px-4 py-3 text-start font-medium">التحكيم</th>
                </tr>
              </thead>
              <tbody>
                {candidates.data.items.map((candidate) => (
                  <tr
                    key={candidate.id}
                    onClick={() => setOpenId(candidate.id)}
                    className={[
                      "cursor-pointer border-b border-outline-variant/60 transition-colors hover:bg-surface-container/50",
                      openId === candidate.id ? "row-active" : "",
                    ].join(" ")}
                  >
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        aria-label={`تحديد ${candidate.fullName}`}
                        checked={selectedSet.has(candidate.id)}
                        onChange={() => toggleSelect(candidate.id)}
                        className="h-4 w-4 accent-primary"
                      />
                    </td>
                    <td className="px-4 py-3 font-body-md text-sm font-medium text-on-surface">
                      <span className="flex items-center gap-2">
                        {candidate.fullName}
                        {candidate.explicitJudgeCount ? (
                          <Chip className="bg-secondary-container text-on-secondary-container">
                            <Icon name="how_to_reg" className="text-[14px]" />
                            محكّمون معيّنون
                          </Chip>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-body-md text-sm text-on-surface-variant">
                      {candidate.category.labelAr}
                    </td>
                    <td className="px-4 py-3 font-body-md text-sm text-on-surface-variant">
                      {GENDER_LABELS[candidate.gender]}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="max-w-[220px] truncate font-arabic-body text-sm text-on-surface">
                          {candidate.scopeRaw}
                        </span>
                        {candidate.scopeReversed ? (
                          <Chip className="shrink-0 bg-error-container text-on-error-container">
                            مقلوب
                          </Chip>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">{judgingChip(candidate)}</td>
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

      <CandidateDrawer candidateId={openId} onClose={() => setOpenId(null)} />

      {bulkOpen ? (
        <BulkAssignModal
          candidateIds={selected}
          onClose={() => setBulkOpen(false)}
          onDone={(assigned) => {
            setBulkOpen(false);
            setSelected([]);
            setNotice(
              `تم إسناد المحكّم إلى ${toDisplayDigits(assigned)} مشاركًا.`,
            );
          }}
        />
      ) : null}
    </div>
  );
}
