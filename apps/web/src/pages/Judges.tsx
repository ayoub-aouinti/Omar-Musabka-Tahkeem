import { useState } from "react";
import { toDisplayDigits } from "@tahkeem/shared";
import {
  useCompetitions,
  useCreateJudge,
  useDeleteJudge,
  useGrantAccess,
  useJudgeStats,
  useJudges,
  useRevokeAccess,
} from "../hooks";
import { useSelectedCompetition } from "../lib/competitionContext";
import { useDebounce } from "../lib/useDebounce";
import { apiErrorMessage } from "../lib/api";
import { GENDER_LABELS } from "../lib/labels";
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
import type { AccessGrant, Gender, Judge } from "../types";

const DURATIONS = [
  { hours: 4, label: "4 ساعات" },
  { hours: 8, label: "8 ساعات" },
  { hours: 24, label: "24 ساعة" },
];

function sessionState(judge: Judge): {
  label: string;
  className: string;
} {
  const now = Date.now();
  const active = judge.accessSessions.find(
    (s) => !s.consumedAt && new Date(s.expiresAt).getTime() > now,
  );
  if (active) {
    return {
      label: "جلسة نشطة",
      className: "bg-primary-container text-on-primary",
    };
  }
  const consumed = judge.accessSessions.some((s) => s.consumedAt);
  if (consumed) {
    return {
      label: "مُستخدَم",
      className: "bg-secondary-container text-on-secondary-container",
    };
  }
  return {
    label: "لا توجد جلسة",
    className: "bg-surface-container-highest text-on-surface-variant",
  };
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="font-label-md text-xs text-on-surface-variant">{label}</p>
      <p className="mt-1 font-headline-lg text-2xl text-on-surface">
        {toDisplayDigits(value)}
      </p>
    </Card>
  );
}

/* --------------------------- new-judge modal ------------------------------ */

function NewJudgeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateJudge();
  const [form, setForm] = useState({
    fullName: "",
    gender: "MALE" as Gender,
    residence: "",
    externalNo: "",
  });
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await create.mutateAsync({
        fullName: form.fullName.trim(),
        gender: form.gender,
        residence: form.residence.trim() || undefined,
        externalNo: form.externalNo ? Number(form.externalNo) : undefined,
      });
      setForm({ fullName: "", gender: "MALE", residence: "", externalNo: "" });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="محكّم جديد">
      <div className="flex flex-col gap-4">
        {error ? (
          <Banner tone="error" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <label className="font-label-md text-sm text-on-surface-variant">
            الاسم الكامل
          </label>
          <Input
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-sm text-on-surface-variant">
              الجنس
            </label>
            <Select
              value={form.gender}
              onChange={(e) =>
                setForm((f) => ({ ...f, gender: e.target.value as Gender }))
              }
            >
              <option value="MALE">{GENDER_LABELS.MALE}</option>
              <option value="FEMALE">{GENDER_LABELS.FEMALE}</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-sm text-on-surface-variant">
              الرقم (اختياري)
            </label>
            <Input
              type="number"
              value={form.externalNo}
              onChange={(e) =>
                setForm((f) => ({ ...f, externalNo: e.target.value }))
              }
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="font-label-md text-sm text-on-surface-variant">
            مكان الإقامة (اختياري)
          </label>
          <Input
            value={form.residence}
            onChange={(e) =>
              setForm((f) => ({ ...f, residence: e.target.value }))
            }
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            icon="save"
            loading={create.isPending}
            disabled={!form.fullName.trim()}
            onClick={submit}
          >
            حفظ
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------- access modal --------------------------------- */

function AccessModal({
  judge,
  onClose,
}: {
  judge: Judge | null;
  onClose: () => void;
}) {
  const competitions = useCompetitions();
  const { selectedId } = useSelectedCompetition();
  const grant = useGrantAccess();
  const [competitionId, setCompetitionId] = useState(selectedId ?? "");
  const [hours, setHours] = useState(8);
  const [result, setResult] = useState<AccessGrant | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setResult(null);
    setError(null);
    onClose();
  }

  async function submit() {
    if (!judge) return;
    setError(null);
    const compId = competitionId || selectedId || "";
    if (!compId) {
      setError("اختر مسابقة");
      return;
    }
    try {
      const granted = await grant.mutateAsync({
        judgeId: judge.id,
        competitionId: compId,
        hours,
      });
      setResult(granted);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <Modal
      open={judge !== null}
      onClose={reset}
      title={result ? "بيانات الدخول المؤقّت" : `توليد حساب مؤقّت — ${judge?.fullName ?? ""}`}
      className="max-w-md"
    >
      {result ? (
        <div className="flex flex-col gap-4">
          <div className="print-area flex flex-col items-center gap-3 rounded-xl border border-outline-variant p-6">
            <p className="font-headline-md text-lg text-on-surface">
              {judge?.fullName}
            </p>
            <img
              src={result.qrDataUrl}
              alt="رمز الدخول"
              className="h-56 w-56"
            />
            <p className="font-label-md text-sm text-on-surface-variant">
              رمز الدخول
            </p>
            <p
              dir="ltr"
              className="font-headline-lg text-3xl tracking-widest text-primary"
            >
              {result.displayCode}
            </p>
            <p className="font-body-md text-xs text-on-surface-variant">
              صالح حتى{" "}
              {toDisplayDigits(
                new Intl.DateTimeFormat("ar-TN-u-ca-gregory", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(result.expiresAt)),
              )}
            </p>
          </div>

          <Banner tone="info">
            هذا الرمز يُعرَض مرّة واحدة فقط ويُستخدم لمرّة واحدة. اطبعه أو سلّمه
            للمحكّم الآن.
          </Banner>

          <div className="no-print flex justify-end gap-2">
            <Button variant="outline" icon="print" onClick={() => window.print()}>
              طباعة
            </Button>
            <Button icon="check" onClick={reset}>
              تم
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {error ? (
            <Banner tone="error" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-sm text-on-surface-variant">
              المسابقة
            </label>
            <Select
              value={competitionId}
              onChange={(e) => setCompetitionId(e.target.value)}
            >
              <option value="">— اختر —</option>
              {competitions.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-sm text-on-surface-variant">
              مدّة الصلاحية
            </label>
            <div className="flex gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.hours}
                  type="button"
                  onClick={() => setHours(d.hours)}
                  className={[
                    "flex-1 rounded-full border px-3 py-2 font-label-md text-sm transition-colors",
                    hours === d.hours
                      ? "border-primary bg-primary text-on-primary"
                      : "border-outline text-on-surface hover:bg-surface-container",
                  ].join(" ")}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={reset}>
              إلغاء
            </Button>
            <Button icon="qr_code_2" loading={grant.isPending} onClick={submit}>
              توليد الحساب
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------ page -------------------------------------- */

export function JudgesPage() {
  const { selectedId } = useSelectedCompetition();
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search);
  const judges = useJudges(debounced);
  const stats = useJudgeStats(selectedId ?? undefined);
  const revoke = useRevokeAccess();
  const del = useDeleteJudge();

  const [newOpen, setNewOpen] = useState(false);
  const [accessJudge, setAccessJudge] = useState<Judge | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function revokeActive(judge: Judge) {
    const active = judge.accessSessions.find(
      (s) => !s.consumedAt && new Date(s.expiresAt).getTime() > Date.now(),
    );
    if (!active) return;
    setError(null);
    try {
      await revoke.mutateAsync(active.id);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function removeJudge(judge: Judge) {
    setError(null);
    try {
      await del.mutateAsync(judge.id);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-3xl text-on-surface">المحكّمون</h1>
          <p className="mt-1 font-body-md text-sm text-on-surface-variant">
            إدارة المحكّمين وتوليد حسابات الدخول المؤقّتة
          </p>
        </div>
        <Button icon="person_add" onClick={() => setNewOpen(true)}>
          محكّم جديد
        </Button>
      </header>

      <div className="grid grid-cols-3 gap-gutter-md">
        <StatCard label="إجمالي المحكّمين" value={stats.data?.totalJudges ?? 0} />
        <StatCard label="جلسات نشطة" value={stats.data?.activeSessions ?? 0} />
        <StatCard
          label="جلسات منتهية"
          value={stats.data?.expiredSessions ?? 0}
        />
      </div>

      {error ? (
        <Banner tone="error" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b border-outline-variant p-4">
          <div className="relative max-w-sm">
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
        </div>

        {judges.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : judges.isError ? (
          <ErrorState
            message={apiErrorMessage(judges.error)}
            onRetry={() => judges.refetch()}
          />
        ) : !judges.data || judges.data.length === 0 ? (
          <EmptyState
            icon="gavel"
            title="لا يوجد محكّمون"
            hint="أضف محكّمًا جديدًا للبدء."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-outline-variant text-start font-label-md text-xs text-on-surface-variant">
                  <th className="px-4 py-3 text-start font-medium">الاسم</th>
                  <th className="px-4 py-3 text-start font-medium">الجنس</th>
                  <th className="px-4 py-3 text-start font-medium">الإقامة</th>
                  <th className="px-4 py-3 text-start font-medium">الجلسات</th>
                  <th className="px-4 py-3 text-start font-medium">الحالة</th>
                  <th className="px-4 py-3 text-end font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {judges.data.map((judge) => {
                  const state = sessionState(judge);
                  const hasActive = state.label === "جلسة نشطة";
                  return (
                    <tr
                      key={judge.id}
                      className="border-b border-outline-variant/60"
                    >
                      <td className="px-4 py-3 font-body-md text-sm font-medium text-on-surface">
                        {judge.fullName}
                      </td>
                      <td className="px-4 py-3 font-body-md text-sm text-on-surface-variant">
                        {GENDER_LABELS[judge.gender]}
                      </td>
                      <td className="px-4 py-3 font-body-md text-sm text-on-surface-variant">
                        {judge.residence ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-body-md text-sm text-on-surface">
                        {toDisplayDigits(judge._count.judgingSessions)}
                      </td>
                      <td className="px-4 py-3">
                        <Chip className={state.className}>{state.label}</Chip>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="primary"
                            icon="qr_code_2"
                            onClick={() => setAccessJudge(judge)}
                          >
                            توليد حساب مؤقّت
                          </Button>
                          {hasActive ? (
                            <Button
                              variant="outline"
                              icon="block"
                              loading={revoke.isPending}
                              onClick={() => revokeActive(judge)}
                            >
                              إلغاء الجلسة
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            icon="delete"
                            onClick={() => removeJudge(judge)}
                          >
                            حذف
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <NewJudgeModal open={newOpen} onClose={() => setNewOpen(false)} />
      <AccessModal judge={accessJudge} onClose={() => setAccessJudge(null)} />
    </div>
  );
}
