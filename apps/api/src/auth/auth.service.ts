import { createHash } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import type { JwtPayload } from "../common/auth.types";
import { PrismaService } from "../prisma/prisma.service";

export interface AuthResult {
  accessToken: string;
  user: {
    id: string;
    name: string;
    role: UserRole;
    judgeId?: string;
    competitionId?: string;
    expiresAt?: Date;
  };
}

/** QR tokens are stored hashed, so the plaintext only ever lives in the QR. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async loginWithPassword(email: string, password: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { judge: true },
    });

    // Compare against a dummy hash when the user is missing so that a wrong
    // email and a wrong password take the same time to reject.
    const hash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinva";
    const ok = await bcrypt.compare(password, hash);

    if (!user || !ok || !user.isActive) {
      throw new UnauthorizedException("بيانات الاعتماد غير صحيحة");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      name: user.name,
      ...(user.judge ? { judgeId: user.judge.id } : {}),
    };

    return {
      accessToken: await this.sign(payload, "JWT_ADMIN_TTL"),
      user: { id: user.id, name: user.name, role: user.role, judgeId: user.judge?.id },
    };
  }

  /**
   * Exchange a scanned QR token for a judge access token.
   *
   * The credential is single-use: the first successful scan stamps `consumedAt`.
   * A second scan of the same card is rejected, so a photographed QR cannot be
   * replayed by someone else.
   */
  async loginWithQr(token: string): Promise<AuthResult> {
    const access = await this.prisma.judgeAccess.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { judge: true, competition: true },
    });

    if (!access) throw new UnauthorizedException("رمز الدخول غير صالح");
    if (access.revokedAt) throw new UnauthorizedException("تم إلغاء هذا الرمز");
    if (access.consumedAt) {
      throw new UnauthorizedException("تم استعمال هذا الرمز من قبل");
    }
    if (access.expiresAt <= new Date()) {
      throw new UnauthorizedException("انتهت صلاحية الرمز");
    }

    await this.prisma.judgeAccess.update({
      where: { id: access.id },
      data: { consumedAt: new Date() },
    });

    const payload: JwtPayload = {
      sub: access.judgeId,
      role: UserRole.JUDGE,
      name: access.judge.fullName,
      judgeId: access.judgeId,
      competitionId: access.competitionId,
    };

    // The token must not outlive the QR card it came from.
    const remainingMs = access.expiresAt.getTime() - Date.now();
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: Math.floor(remainingMs / 1000),
    });

    return {
      accessToken,
      user: {
        id: access.judgeId,
        name: access.judge.fullName,
        role: UserRole.JUDGE,
        judgeId: access.judgeId,
        competitionId: access.competitionId,
        expiresAt: access.expiresAt,
      },
    };
  }

  private sign(payload: JwtPayload, ttlKey: string): Promise<string> {
    return this.jwt.signAsync(payload, {
      expiresIn: this.config.get<string>(ttlKey) ?? "12h",
    });
  }
}
