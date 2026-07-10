import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../lib/auth";
import { Spinner } from "./ui";

/** Gate a subtree behind an authenticated ADMIN. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Spinner className="h-10 w-10 text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user.role !== "ADMIN") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background text-center">
        <span className="material-symbols-outlined text-[48px] text-error">
          lock
        </span>
        <p className="font-headline-md text-lg text-on-surface">
          هذه اللوحة مخصّصة للمشرفين فقط
        </p>
        <p className="font-body-md text-sm text-on-surface-variant">
          حسابك بصلاحية محكّم ولا يملك صلاحية الوصول إلى لوحة الإدارة.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
