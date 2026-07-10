import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail({}, { message: "البريد الإلكتروني غير صالح" })
  email!: string;

  @IsString()
  @MinLength(6, { message: "كلمة المرور قصيرة جدًا" })
  password!: string;
}

/** The plaintext token scanned out of a judge's QR card. */
export class QrLoginDto {
  @IsString()
  @IsNotEmpty({ message: "رمز الدخول مفقود" })
  token!: string;
}

/** The typed `رمز التحقّق`, in any casing, with or without the dash. */
export class CodeLoginDto {
  @IsString()
  @IsNotEmpty({ message: "أدخل رمز التحقّق" })
  code!: string;
}
