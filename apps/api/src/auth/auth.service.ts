import { createHash } from "node:crypto";
import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@prisma/client";
import { isAccessCodeShaped, normalizeAccessCode } from "@tahkeem/shared";
import * as bcrypt from "bcryptjs";
import type { JwtPayload } from "../common/auth.types";
import { PrismaService } from "../prisma/prisma.service";

/** A judge fat-fingering a code gets a handful of tries; a script does not. */
const MAX_CODE_ATTEMPTS = 6;
const CODE_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

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
  loginWithQr(token: string): Promise<AuthResult> {
    return this.redeem({ tokenHash: hashToken(token) });
  }

  /**
   * Exchange a typed `رمز التحقّق` for a judge access token — the fallback when
   * the camera will not read the card.
   *
   * The code is only 8 characters, so unlike the QR token it is within reach of
   * a guessing attack. Three defences, all required: the credential is
   * single-use, it expires within hours, and `assertNotThrottled` caps attempts
   * per client.
   */
  async loginWithCode(rawCode: string, clientKey: string): Promise<AuthResult> {
    this.assertNotThrottled(clientKey);

    const code = normalizeAccessCode(rawCode);
    if (!isAccessCodeShaped(code)) {
      this.recordFailure(clientKey);
      throw new UnauthorizedException("رمز التحقّق غير صالح");
    }

    try {
      const result = await this.redeem({ codeHash: hashToken(code) });
      this.attempts.delete(clientKey);
      return result;
    } catch (error) {
      this.recordFailure(clientKey);
      throw error;
    }
  }

  /** The shared redemption path for both secrets on a JudgeAccess row. */
  private async redeem(
    where: { tokenHash: string } | { codeHash: string },
  ): Promise<AuthResult> {
    const access = await this.prisma.judgeAccess.findUnique({
      where: where as never,
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

    // Redeeming either secret retires the whole credential.
    const claimed = await this.prisma.judgeAccess.updateMany({
      where: { id: access.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    // Two devices racing the same card: only the one that flipped the row wins.
    if (claimed.count === 0) {
      throw new UnauthorizedException("تم استعمال هذا الرمز من قبل");
    }

    const payload: JwtPayload = {
      sub: access.judgeId,
      role: UserRole.JUDGE,
      name: access.judge.fullName,
      judgeId: access.judgeId,
      competitionId: access.competitionId,
    };

    // The session must not outlive the card it came from.
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

  // ── brute-force throttling for the short code ──

  private readonly attempts = new Map<
    string,
    { count: number; firstAt: number }
  >();

  private assertNotThrottled(clientKey: string): void {
    const entry = this.attempts.get(clientKey);
    if (!entry) return;

    if (Date.now() - entry.firstAt > CODE_ATTEMPT_WINDOW_MS) {
      this.attempts.delete(clientKey);
      return;
    }
    if (entry.count >= MAX_CODE_ATTEMPTS) {
      throw new HttpException(
        "محاولات كثيرة. أعد المحاولة بعد ١٥ دقيقة",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private recordFailure(clientKey: string): void {
    const entry = this.attempts.get(clientKey);
    if (!entry || Date.now() - entry.firstAt > CODE_ATTEMPT_WINDOW_MS) {
      this.attempts.set(clientKey, { count: 1, firstAt: Date.now() });
      return;
    }
    entry.count += 1;
  }

  private sign(payload: JwtPayload, ttlKey: string): Promise<string> {
    return this.jwt.signAsync(payload, {
      expiresIn: this.config.get<string>(ttlKey) ?? "12h",
    });
  }
}
