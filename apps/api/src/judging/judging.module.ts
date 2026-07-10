import { Module } from "@nestjs/common";
import { CompetitionsModule } from "../competitions/competitions.module";
import { QuestionsModule } from "../questions/questions.module";
import { JudgingController } from "./judging.controller";
import { JudgingService } from "./judging.service";

@Module({
  imports: [CompetitionsModule, QuestionsModule],
  controllers: [JudgingController],
  providers: [JudgingService],
})
export class JudgingModule {}
