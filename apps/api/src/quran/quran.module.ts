import { Global, Module } from "@nestjs/common";
import { QuranController } from "./quran.controller";
import { QuranService } from "./quran.service";

@Global()
@Module({
  controllers: [QuranController],
  providers: [QuranService],
  exports: [QuranService],
})
export class QuranModule {}
