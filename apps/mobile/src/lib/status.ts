import type { JudgingStatus } from "@tahkeem/shared";
import { colors } from "../theme";
import type { CandidateSessionSummary } from "../types";

export interface StatusInfo {
  status: JudgingStatus;
  label: string;
  /** Border/accent colour for the candidate card. */
  color: string;
  /** Softer fill used behind the status chip. */
  container: string;
  onContainer: string;
}

const MAP: Record<JudgingStatus, Omit<StatusInfo, "status">> = {
  PENDING: {
    label: "قيد الانتظار",
    color: colors.outline,
    container: colors.surfaceContainerHigh,
    onContainer: colors.onSurfaceVariant,
  },
  IN_PROGRESS: {
    label: "قيد التحكيم",
    color: colors.primaryContainer,
    container: colors.primaryFixed,
    onContainer: colors.onPrimaryContainer,
  },
  DRAFT_SAVED: {
    label: "مسودة محفوظة",
    color: colors.tertiary,
    container: colors.tertiaryFixed,
    onContainer: colors.onSurfaceVariant,
  },
  SUBMITTED: {
    label: "مكتمل",
    color: colors.primary,
    container: colors.primaryFixed,
    onContainer: colors.onPrimaryContainer,
  },
};

export function statusInfo(session?: CandidateSessionSummary): StatusInfo {
  const status: JudgingStatus = session?.status ?? "PENDING";
  return { status, ...MAP[status] };
}
