import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useCandidate,
  useCompetition,
  useCreateCandidate,
  useScopePreview,
  useUpdateCandidate,
} from "../hooks";
import { useSelectedCompetition } from "../lib/competitionContext";
import { useDebounce } from "../lib/useDebounce";
import { apiErrorMessage } from "../lib/api";
import { GENDER_LABELS } from "../lib/labels";
import {
  Banner,
  Button,
  Card,
  Icon,
  Input,
  Select,
  Spinner,
} from "../components/ui";
import { ScopeSummary } from "../components/ScopeSummary";
import type { CandidateCreate, Gender } from "../types";

interface FormState {
  fullName: string;
  gender: Gender;
  categoryId: string;
  externalId: string;
  teacherName: string;
  birthDate: string;
  scopeRaw: string;
}

const EMPTY: FormState = {
  fullName: "",
  gender: "MALE",
  categoryId: "",
  externalId: "",
  teacherName: "",
  birthDate: "",
  scopeRaw: "",
};

function ScopePreview({ raw }: { raw: string }) {
  const debounced = useDebounce(raw, 400);
  const preview = useScopePreview(debounced);

  if (!debounced.trim()) {
    return (
      <p className="font-body-md text-sm text-on-surface-variant">
        اكتب نطاق الحفظ لمعاينته مباشرة، مثال: «من مريم إلى الناس».
      </p>
    );
  }
  if (preview.isFetching) {
    return (
      <div className="flex items-center gap-2 text-on-surface-variant">
        <Spinner className="h-4 w-4" /> جارٍ التحقّق…
      </div>
    );
  }
  if (preview.isError) {
    return (
      <div className="flex items-start gap-2 text-error">
        <Icon name="error" className="text-[20px]" />
        <span className="font-body-md text-sm">
          {apiErrorMessage(preview.error, "تعذّر تحليل النطاق")}
        </span>
      </div>
    );
  }
  if (preview.data) {
    return <ScopeSummary scope={preview.data} />;
  }
  return null;
}

export function CandidateFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { selectedId } = useSelectedCompetition();

  const existing = useCandidate(isEdit ? id : undefined);
  const competitionId = isEdit
    ? existing.data?.competitionId ?? selectedId ?? undefined
    : selectedId ?? undefined;
  const competition = useCompetition(competitionId);

  const create = useCreateCandidate();
  const update = useUpdateCandidate(id ?? "");

  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  // Prefill on edit once the candidate loads.
  useEffect(() => {
    if (isEdit && existing.data) {
      setForm({
        fullName: existing.data.fullName,
        gender: existing.data.gender,
        categoryId: existing.data.category.id,
        externalId: existing.data.externalId ?? "",
        teacherName: existing.data.teacherName ?? "",
        birthDate: existing.data.birthDate
          ? existing.data.birthDate.slice(0, 10)
          : "",
        scopeRaw: existing.data.scopeRaw,
      });
    }
  }, [isEdit, existing.data]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const categories = competition.data?.categories ?? [];
  const canSubmit = useMemo(
    () =>
      form.fullName.trim().length > 0 &&
      form.categoryId.length > 0 &&
      form.scopeRaw.trim().length > 0,
    [form],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (isEdit) {
        await update.mutateAsync({
          fullName: form.fullName.trim(),
          gender: form.gender,
          categoryId: form.categoryId,
          externalId: form.externalId.trim() || undefined,
          teacherName: form.teacherName.trim() || undefined,
          birthDate: form.birthDate || undefined,
          scopeRaw: form.scopeRaw.trim(),
        });
      } else {
        if (!competitionId) {
          setError("اختر مسابقة أولًا من القائمة الجانبية");
          return;
        }
        const payload: CandidateCreate = {
          competitionId,
          categoryId: form.categoryId,
          fullName: form.fullName.trim(),
          gender: form.gender,
          externalId: form.externalId.trim() || undefined,
          teacherName: form.teacherName.trim() || undefined,
          birthDate: form.birthDate || undefined,
          scopeRaw: form.scopeRaw.trim(),
        };
        await create.mutateAsync(payload);
      }
      navigate("/candidates");
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  if (!isEdit && !competitionId) {
    return (
      <Banner tone="info">
        اختر مسابقة من القائمة الجانبية قبل إضافة مشارك.
      </Banner>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container"
          aria-label="رجوع"
        >
          <Icon name="arrow_forward" />
        </button>
        <div>
          <h1 className="font-headline-lg text-3xl text-on-surface">
            {isEdit ? "تعديل بيانات مشارك" : "مشارك جديد"}
          </h1>
          <p className="mt-1 font-body-md text-sm text-on-surface-variant">
            {competition.data?.name ?? ""}
          </p>
        </div>
      </header>

      <form onSubmit={submit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:col-span-2">
          {error ? (
            <div className="sm:col-span-2">
              <Banner tone="error" onDismiss={() => setError(null)}>
                {error}
              </Banner>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="font-label-md text-sm text-on-surface-variant">
              الاسم الكامل
            </label>
            <Input
              required
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-sm text-on-surface-variant">
              الصنف
            </label>
            <Select
              required
              value={form.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
            >
              <option value="">— اختر —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.labelAr}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-sm text-on-surface-variant">
              الجنس
            </label>
            <Select
              value={form.gender}
              onChange={(e) => set("gender", e.target.value as Gender)}
            >
              <option value="MALE">{GENDER_LABELS.MALE}</option>
              <option value="FEMALE">{GENDER_LABELS.FEMALE}</option>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-sm text-on-surface-variant">
              الرقم التسلسلي (اختياري)
            </label>
            <Input
              value={form.externalId}
              onChange={(e) => set("externalId", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-sm text-on-surface-variant">
              تاريخ الميلاد (اختياري)
            </label>
            <Input
              type="date"
              value={form.birthDate}
              onChange={(e) => set("birthDate", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="font-label-md text-sm text-on-surface-variant">
              اسم المعلّم (اختياري)
            </label>
            <Input
              value={form.teacherName}
              onChange={(e) => set("teacherName", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="font-label-md text-sm text-on-surface-variant">
              نطاق الحفظ
            </label>
            <Input
              required
              dir="rtl"
              placeholder="مثال: من مريم إلى الناس"
              value={form.scopeRaw}
              onChange={(e) => set("scopeRaw", e.target.value)}
              className="font-arabic-body text-base"
            />
          </div>

          <div className="sm:col-span-2">
            <Button
              type="submit"
              icon="save"
              disabled={!canSubmit}
              loading={create.isPending || update.isPending}
            >
              {isEdit ? "حفظ التعديلات" : "إضافة المشارك"}
            </Button>
          </div>
        </Card>

        <Card className="h-fit p-6">
          <div className="mb-3 flex items-center gap-2 text-on-surface-variant">
            <Icon name="travel_explore" className="text-[20px]" />
            <h3 className="font-label-md text-sm font-medium">معاينة النطاق</h3>
          </div>
          <ScopePreview raw={form.scopeRaw} />
        </Card>
      </form>
    </div>
  );
}
