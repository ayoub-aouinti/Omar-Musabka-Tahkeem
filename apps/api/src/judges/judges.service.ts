import { randomBytes, randomInt } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import type { Gender } from "@prisma/client";
import {
  ACCESS_CODE_ALPHABET,
  ACCESS_CODE_LENGTH,
  formatAccessCode,
} from "@tahkeem/shared";
import * as QRCode from "qrcode";
import { hashToken } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";

export interface IssuedAccess {
  id: string;
  displayCode: string;
  expiresAt: Date;
  /** Plaintext token — returned exactly once, at issue time. */
  token: string;
  /** The typed `رمز التحقّق`, grouped as ABCD-EFGH. Returned exactly once. */
  accessCode: string;
  /** PNG data URI of the QR the judge scans. */
  qrDataUrl: string;
}

/** Uniform over the alphabet: `randomInt` avoids the modulo bias of `% len`. */
function generateAccessCode(): string {
  let code = "";
  for (let i = 0; i < ACCESS_CODE_LENGTH; i++) {
    code += ACCESS_CODE_ALPHABET[randomInt(ACCESS_CODE_ALPHABET.length)];
  }
  return code;
}

@Injectable()
export class JudgesService {
  constructor(private readonly prisma: PrismaService) {}

  list(search?: string) {
    return this.prisma.judge.findMany({
      where: search
        ? { fullName: { contains: search, mode: "insensitive" } }
        : undefined,
      orderBy: { externalNo: "asc" },
      include: {
        accessSessions: {
          where: { revokedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            displayCode: true,
            expiresAt: true,
            consumedAt: true,
            competitionId: true,
          },
        },
        _count: { select: { judgingSessions: true } },
      },
    });
  }

  async get(id: string) {
    const judge = await this.prisma.judge.findUnique({
      where: { id },
      include: { user: { select: { email: true, isActive: true } } },
    });
    if (!judge) throw new NotFoundException("المحكّم غير موجود");
    return judge;
  }

  create(input: {
    fullName: string;
    gender: Gender;
    residence?: string;
    externalNo?: number;
  }) {
    return this.prisma.judge.create({ data: input });
  }

  async update(
    id: string,
    input: Partial<{ fullName: string; gender: Gender; residence: string }>,
  ) {
    await this.get(id);
    return this.prisma.judge.update({ where: { id }, data: input });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.judge.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Mint a temporary QR credential for a judge on a competition.
   *
   * Issuing a new card revokes the judge's other live cards for that
   * competition, so exactly one credential is valid at a time — a lost card
   * stops working the moment a replacement is printed.
   */
  async issueAccess(
    judgeId: string,
    competitionId: string,
    hours: number,
  ): Promise<IssuedAccess> {
    await this.get(judgeId);

    const competition = await this.prisma.competition.findUnique({
      where: { id: competitionId },
    });
    if (!competition) throw new NotFoundException("المسابقة غير موجودة");

    await this.prisma.judgeAccess.updateMany({
      where: { judgeId, competitionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // 256 bits of entropy: unguessable, and only its hash is persisted.
    const token = randomBytes(32).toString("base64url");
    // Short enough to type off a printed card; safe only because the credential
    // is short-lived and guesses are throttled in AuthService.
    const accessCode = generateAccessCode();
    const displayCode = `QX-${randomInt(1000, 9999)}`;
    const expiresAt = new Date(Date.now() + hours * 3600 * 1000);

    const access = await this.prisma.judgeAccess.create({
      data: {
        judgeId,
        competitionId,
        tokenHash: hashToken(token),
        codeHash: hashToken(accessCode),
        displayCode,
        expiresAt,
      },
    });

    const qrDataUrl = await QRCode.toDataURL(token, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 512,
      color: { dark: "#006b33", light: "#ffffff" },
    });

    return {
      id: access.id,
      displayCode,
      expiresAt,
      token,
      accessCode: formatAccessCode(accessCode),
      qrDataUrl,
    };
  }

  async revokeAccess(accessId: string) {
    const access = await this.prisma.judgeAccess.findUnique({
      where: { id: accessId },
    });
    if (!access) throw new NotFoundException("الرمز غير موجود");

    await this.prisma.judgeAccess.update({
      where: { id: accessId },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  }

  /** Live QR sessions, for the dashboard's session table. */
  listAccess(competitionId: string) {
    return this.prisma.judgeAccess.findMany({
      where: { competitionId },
      orderBy: { createdAt: "desc" },
      include: { judge: { select: { id: true, fullName: true, gender: true } } },
    });
  }

  async stats(competitionId: string) {
    const now = new Date();
    const [total, active, expired] = await Promise.all([
      this.prisma.judge.count(),
      this.prisma.judgeAccess.count({
        where: { competitionId, revokedAt: null, expiresAt: { gt: now } },
      }),
      this.prisma.judgeAccess.count({
        where: { competitionId, expiresAt: { lte: now } },
      }),
    ]);
    return { totalJudges: total, activeSessions: active, expiredSessions: expired };
  }
}
