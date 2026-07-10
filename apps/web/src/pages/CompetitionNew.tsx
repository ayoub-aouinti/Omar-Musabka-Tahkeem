import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toArabicDigits } from "@tahkeem/shared";
import { api, apiErrorMessage } from "../lib/api";
import { useCreateCompetition } from "../hooks";
import { useSelectedCompetition } from "../lib/competitionContext";
import {
  Banner,
  Button,
  Card,
  Icon,
  Input,
  Spinner,
} from "../components/ui";
import type { CompetitionSummary, ImportReport } from "../types";

async function uploadWorkbook(
  competitionId: string,
  file: File,
  dryRun: boolean,
): Promise<ImportReport> {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post<ImportReport>(
    `/imports/competitions/${competitionId}/workbook`,
    form,
    { params: { dryRun } },
  );
  return res.data;
}

function ReportView({ report }: { report: ImportReport }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3">
          <p className="font-label-md text-xs text-on-surface-variant">
            مشاركون مستوردون
          </p>
          <p className="font-headline-md text-xl text-primary">
            {toArabicDigits(report.candidates.imported)}
          </p>
        </Card>
        <Card className="p-3">
          <p className="font-label-md text-xs text-on-surface-variant">
            مشاركون متجاهَلون
          </p>
          <p className="font-headline-md text-xl text-on-surface">
            {toArabicDigits(report.candidates.skipped)}
          </p>
        </Card>
        <Card className="p-3">
          <p className="font-label-md text-xs text-on-surface-variant">
            محكّمون مستوردون
          </p>
          <p className="font-headline-md text-xl text-on-surface">
            {toArabicDigits(report.judges.imported)}
          </p>
        </Card>
        <Card className="p-3">
          <p className="font-label-md text-xs text-on-surface-variant">
            أصناف مُنشأة
          </p>
          <p className="font-headline-md text-xl text-on-surface">
            {toArabicDigits(report.categoriesCreated.length)}
          </p>
        </Card>
      </div>

      {report.categoriesCreated.length ? (
        <p className="font-body-md text-sm text-on-surface-variant">
          أحزاب الأصناف المُنشأة:{" "}
          {report.categoriesCreated
            .map((n) => toArabicDigits(n))
            .join("، ")}
        </p>
      ) : null}

      {report.errors.length ? (
        <div className="overflow-hidden rounded-lg border border-error-container">
          <div className="bg-error-container px-3 py-2 font-label-md text-xs text-on-error-container">
            أخطاء ({toArabicDigits(report.errors.length)})
          </div>
          <table className="w-full text-start text-sm">
            <thead>
              <tr className="border-b border-outline-variant font-label-md text-xs text-on-surface-variant">
                <th className="px-3 py-2 text-start font-medium">الصف</th>
                <th className="px-3 py-2 text-start font-medium">الاسم</th>
                <th className="px-3 py-2 text-start font-medium">السبب</th>
              </tr>
            </thead>
            <tbody>
              {report.errors.map((e, i) => (
                <tr key={i} className="border-t border-outline-variant/60">
                  <td className="px-3 py-2 text-on-surface-variant">
                    {toArabicDigits(e.row)}
                  </td>
                  <td className="px-3 py-2 text-on-surface">{e.name}</td>
                  <td className="px-3 py-2 text-error">{e.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function ImportPanel({ competition }: { competition: CompetitionSummary }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [committed, setCommitted] = useState<ImportReport | null>(null);

  function pick(selected: File | null) {
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith(".xlsx")) {
      setError("يُقبل ملف Excel بامتداد ‎.xlsx فقط");
      return;
    }
    setError(null);
    setPreview(null);
    setCommitted(null);
    setFile(selected);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files[0] ?? null);
  }

  async function runDryRun() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const report = await uploadWorkbook(competition.id, file, true);
      setPreview(report);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const report = await uploadWorkbook(competition.id, file, false);
      setCommitted(report);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (committed) {
    return (
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2 text-primary">
          <Icon name="check_circle" />
          <h3 className="font-headline-md text-lg">اكتمل الاستيراد</h3>
        </div>
        <ReportView report={committed} />
        <div className="mt-6 flex gap-2">
          <Button
            icon="arrow_back"
            onClick={() => navigate(`/competitions/${competition.id}`)}
          >
            الذهاب إلى المسابقة
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="mb-1 font-headline-md text-lg text-on-surface">
        استيراد ملف المشاركين
      </h3>
      <p className="mb-4 font-body-md text-sm text-on-surface-variant">
        اسحب ملف ‎.xlsx وأفلته للمعاينة قبل التأكيد.
      </p>

      {error ? (
        <div className="mb-4">
          <Banner tone="error" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        </div>
      ) : null}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={[
          "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          dragging
            ? "border-primary bg-primary-container/10"
            : "border-outline-variant hover:bg-surface-container/40",
        ].join(" ")}
      >
        <Icon name="upload_file" className="text-[36px] text-primary" />
        <p className="font-body-md text-sm text-on-surface">
          {file ? file.name : "اسحب الملف هنا أو انقر للاختيار"}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          hidden
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
      </div>

      {file ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button icon="preview" loading={busy && !preview} onClick={runDryRun}>
            معاينة (تجربة)
          </Button>
          {preview ? (
            <Button
              variant="primary"
              icon="publish"
              loading={busy}
              onClick={commit}
            >
              تأكيد الاستيراد
            </Button>
          ) : null}
          <Button
            variant="ghost"
            onClick={() => {
              setFile(null);
              setPreview(null);
            }}
          >
            إزالة الملف
          </Button>
        </div>
      ) : null}

      {busy && !preview ? (
        <div className="mt-4 flex items-center gap-2 text-on-surface-variant">
          <Spinner className="h-4 w-4" /> جارٍ التحليل…
        </div>
      ) : null}

      {preview ? (
        <div className="mt-6">
          <Banner tone="info">
            هذه معاينة فقط ولم يتم حفظ أي بيانات بعد. راجع النتائج ثم أكّد
            الاستيراد.
          </Banner>
          <div className="mt-3">
            <ReportView report={preview} />
          </div>
        </div>
      ) : null}
    </Card>
  );
}

export function CompetitionNewPage() {
  const create = useCreateCompetition();
  const { setSelectedId } = useSelectedCompetition();
  const [created, setCreated] = useState<CompetitionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    location: "",
    startDate: "",
    endDate: "",
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const competition = await create.mutateAsync({
        name: form.name.trim(),
        location: form.location.trim() || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      });
      setSelectedId(competition.id);
      setCreated(competition);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-margin-lg">
      <header>
        <h1 className="font-headline-lg text-3xl text-on-surface">
          مسابقة جديدة
        </h1>
        <p className="mt-1 font-body-md text-sm text-on-surface-variant">
          أنشئ المسابقة ثم استورد ملف المشاركين.
        </p>
      </header>

      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <div
            className={[
              "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
              created
                ? "bg-primary text-on-primary"
                : "bg-primary-container/10 text-primary",
            ].join(" ")}
          >
            {created ? <Icon name="check" className="text-[18px]" /> : "١"}
          </div>
          <h2 className="font-headline-md text-lg text-on-surface">
            بيانات المسابقة
          </h2>
        </div>

        {created ? (
          <Banner tone="success">
            تم إنشاء المسابقة «{created.name}». يمكنك الآن استيراد المشاركين.
          </Banner>
        ) : (
          <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {error ? (
              <div className="sm:col-span-2">
                <Banner tone="error" onDismiss={() => setError(null)}>
                  {error}
                </Banner>
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="font-label-md text-sm text-on-surface-variant">
                اسم المسابقة
              </label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="font-label-md text-sm text-on-surface-variant">
                المكان
              </label>
              <Input
                value={form.location}
                onChange={(e) =>
                  setForm((f) => ({ ...f, location: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-label-md text-sm text-on-surface-variant">
                تاريخ البدء
              </label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startDate: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-label-md text-sm text-on-surface-variant">
                تاريخ الانتهاء
              </label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endDate: e.target.value }))
                }
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" icon="add" loading={create.isPending}>
                إنشاء المسابقة
              </Button>
            </div>
          </form>
        )}
      </Card>

      {created ? <ImportPanel competition={created} /> : null}
    </div>
  );
}
