import { UserRole } from "@prisma/client";

/** Payload carried by every access token this API issues. */
export interface JwtPayload {
  sub: string;
  role: UserRole;
  name: string;
  /** Present for judges: the Judge row they act as. */
  judgeId?: string;
  /** Present for QR-issued judge tokens: the competition they were let into. */
  competitionId?: string;
}

export type AuthUser = JwtPayload;

export { UserRole };
