import {
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Material Symbols glyph. Pass the symbol name as `name`. */
export function Icon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span className={cx("material-symbols-outlined", className)} aria-hidden>
      {name}
    </span>
  );
}

type Variant = "primary" | "outline" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-container disabled:opacity-50",
  outline:
    "border border-outline text-on-surface hover:bg-surface-container disabled:opacity-50",
  ghost: "text-on-surface-variant hover:bg-surface-container disabled:opacity-50",
  danger: "bg-error text-on-error hover:opacity-90 disabled:opacity-50",
};

export function Button({
  variant = "primary",
  className,
  icon,
  loading,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  icon?: string;
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-label-md text-sm font-medium transition-colors",
        VARIANTS[variant],
        className,
      )}
    >
      {loading ? (
        <Spinner className="h-4 w-4" />
      ) : icon ? (
        <Icon name={icon} className="text-[20px]" />
      ) : null}
      {children}
    </button>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-xl border border-outline-variant bg-surface-container-lowest",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Chip({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 font-label-md text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-block animate-spin rounded-full border-2 border-current border-t-transparent",
        className ?? "h-5 w-5",
      )}
      role="status"
      aria-label="جارٍ التحميل"
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        "animate-pulse rounded-lg bg-surface-container-high",
        className,
      )}
    />
  );
}

export function EmptyState({
  icon = "inbox",
  title,
  hint,
  action,
}: {
  icon?: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <Icon name={icon} className="text-[48px] text-tertiary-fixed-dim" />
      <p className="font-headline-md text-lg text-on-surface">{title}</p>
      {hint ? (
        <p className="max-w-sm font-body-md text-sm text-on-surface-variant">
          {hint}
        </p>
      ) : null}
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <Icon name="error" className="text-[48px] text-error" />
      <p className="max-w-md font-body-md text-sm text-on-surface">{message}</p>
      {onRetry ? (
        <Button variant="outline" icon="refresh" onClick={onRetry}>
          إعادة المحاولة
        </Button>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1.5">
      <span className="font-label-md text-sm font-medium text-on-surface-variant">
        {label}
      </span>
      {children}
      {hint ? <span className="text-xs text-on-surface-variant">{hint}</span> : null}
      {error ? <span className="text-xs text-error">{error}</span> : null}
    </label>
  );
}

const CONTROL =
  "rounded-lg border border-outline bg-surface-container-lowest px-3 py-2 font-body-md text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(CONTROL, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(CONTROL, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(CONTROL, props.className)} />;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-inverse-surface/40"
        onClick={onClose}
        aria-hidden
      />
      <Card
        className={cx(
          "relative z-10 max-h-[90vh] w-full max-w-lg overflow-auto p-6",
          className,
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-headline-md text-xl text-on-surface">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container"
            aria-label="إغلاق"
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </Card>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-inverse-surface/40"
        onClick={onClose}
        aria-hidden
      />
      {/* RTL: the drawer slides in from the left edge. */}
      <div className="relative z-10 ms-auto flex h-full w-full max-w-md flex-col overflow-auto border-s border-outline-variant bg-surface-container-lowest">
        <div className="sticky top-0 flex items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-6 py-4">
          <h2 className="font-headline-md text-lg text-on-surface">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container"
            aria-label="إغلاق"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/** A dismissable inline banner used for form-level success/error feedback. */
export function Banner({
  tone,
  children,
  onDismiss,
}: {
  tone: "success" | "error" | "info";
  children: ReactNode;
  onDismiss?: () => void;
}) {
  const tones: Record<typeof tone, string> = {
    success: "bg-primary-container/10 border-primary text-on-primary-fixed",
    error: "bg-error-container border-error text-on-error-container",
    info: "bg-surface-container border-outline-variant text-on-surface-variant",
  };
  return (
    <div
      className={cx(
        "flex items-start justify-between gap-3 rounded-lg border p-3 font-body-md text-sm",
        tones[tone],
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      <div className="flex-1">{children}</div>
      {onDismiss ? (
        <button onClick={onDismiss} aria-label="إغلاق">
          <Icon name="close" className="text-[18px]" />
        </button>
      ) : null}
    </div>
  );
}
