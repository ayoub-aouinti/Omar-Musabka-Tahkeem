import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Banner, Button, Input } from "../components/ui";

export function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const signedIn = await login(email.trim(), password);
      if (signedIn.role !== "ADMIN") {
        setError("هذا الحساب لا يملك صلاحية الوصول إلى لوحة الإدارة");
        return;
      }
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تسجيل الدخول");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dotted-bg flex min-h-screen items-center justify-center bg-gradient-to-bl from-primary/10 via-background to-tertiary-fixed/30 p-6">
      <div className="w-full max-w-md rounded-full border border-outline-variant bg-surface-container-lowest/80 p-8 shadow-sm backdrop-blur-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <img
            src="/logo-omar.png"
            alt="شعار جمعية عمر بن الخطاب"
            className="h-24 w-24 rounded-full border border-outline-variant bg-white object-cover shadow-sm"
          />
          <h1 className="font-headline-lg text-2xl text-on-surface">
            منصّة تحكيم المسابقات القرآنية
          </h1>
          <p className="font-body-md text-sm text-on-surface-variant">
            الفرع المحلّي عمر بن الخطاب — دار شعبان الفهري
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error ? <Banner tone="error">{error}</Banner> : null}

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="font-label-md text-sm font-medium text-on-surface-variant"
            >
              البريد الإلكتروني
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="text-start"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="font-label-md text-sm font-medium text-on-surface-variant"
            >
              كلمة المرور
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            loading={submitting}
            className="mt-2 w-full"
            icon="login"
          >
            تسجيل الدخول
          </Button>
        </form>
      </div>
    </div>
  );
}
