import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module";
import { CandidatesModule } from "./candidates/candidates.module";
import { JwtAuthGuard, RolesGuard } from "./common/guards";
import { CompetitionsModule } from "./competitions/competitions.module";
import { ImportsModule } from "./imports/imports.module";
import { JudgesModule } from "./judges/judges.module";
import { JudgingModule } from "./judging/judging.module";
import { PrismaModule } from "./prisma/prisma.module";
import { QuestionsModule } from "./questions/questions.module";
import { QuranModule } from "./quran/quran.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    QuranModule,
    AuthModule,
    CompetitionsModule,
    CandidatesModule,
    JudgesModule,
    QuestionsModule,
    JudgingModule,
    ImportsModule,
  ],
  providers: [
    // Everything is authenticated unless marked @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
