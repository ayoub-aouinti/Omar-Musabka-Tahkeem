import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { JwtPayload } from "../common/auth.types";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_SECRET"),
    });
  }

  /**
   * A valid signature is not enough: an admin may have been deactivated, or a
   * judge's QR session revoked, after the token was issued.
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (payload.judgeId) {
      const judge = await this.prisma.judge.findUnique({
        where: { id: payload.judgeId },
      });
      if (!judge) throw new UnauthorizedException("المحكّم غير موجود");
      return payload;
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user?.isActive) {
      throw new UnauthorizedException("الحساب معطّل");
    }
    return payload;
  }
}
