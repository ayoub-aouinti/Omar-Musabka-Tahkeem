import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../common/auth.types";
import { CurrentUser, Public } from "../common/decorators";
import { AuthService } from "./auth.service";
import { LoginDto, QrLoginDto } from "./dto";

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

  @Get("me")
  @ApiOperation({ summary: "بيانات المستخدم الحالي" })
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
