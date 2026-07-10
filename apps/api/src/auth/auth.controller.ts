import { Body, Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { AuthUser } from "../common/auth.types";
import { CurrentUser, Public } from "../common/decorators";
import { AuthService } from "./auth.service";
import { CodeLoginDto, LoginDto, QrLoginDto } from "./dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  @ApiOperation({ summary: "تسجيل دخول المدير بكلمة المرور" })
  login(@Body() dto: LoginDto) {
    return this.auth.loginWithPassword(dto.email, dto.password);
  }

  @Public()
  @Post("qr")
  @HttpCode(200)
  @ApiOperation({ summary: "تسجيل دخول المحكّم عبر مسح رمز QR (استعمال واحد)" })
  qrLogin(@Body() dto: QrLoginDto) {
    return this.auth.loginWithQr(dto.token);
  }

  @Public()
  @Post("code")
  @HttpCode(200)
  @ApiOperation({ summary: "تسجيل دخول المحكّم برمز التحقّق (استعمال واحد)" })
  codeLogin(@Body() dto: CodeLoginDto, @Req() request: Request) {
    // Throttle per client so an 8-character code cannot be brute-forced.
    const clientKey = request.ip ?? "unknown";
    return this.auth.loginWithCode(dto.code, clientKey);
  }

  @Get("me")
  @ApiOperation({ summary: "بيانات المستخدم الحالي" })
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
