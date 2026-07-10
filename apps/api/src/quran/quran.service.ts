import {
  BadRequestException,
  Injectable,
  type OnModuleInit,
} from "@nestjs/common";
import type { QuranVerse } from "@prisma/client";
import {
  type AmountUnit,
  buildQuranIndex,
  type ParsedScope,
  parseScope,
  type QuranIndex,
} from "@tahkeem/shared";
import { PrismaService } from "../prisma/prisma.service";

/** A hizb is divided into 4 arbaʿ, each of 2 athmān — 8 athmān per hizb. */
const THUMNS_PER_HIZB = 8;
const RUBS_PER_HIZB = 4;

/** Every page of this mushaf is typeset on 15 lines. */
const LINES_PER_PAGE = 15;

@Injectable()
export class QuranService implements OnModuleInit {
  /** 6214 verses — small enough to keep resident and index once. */
  private verses: QuranVerse[] = [];
  private byId = new Map<number, QuranVerse>();
  private index!: QuranIndex;
  /** Ordered verse ids per mushaf page and per hizb, for passage arithmetic. */
  private pageVerses = new Map<string, number[]>();
  private hizbVerses = new Map<number, number[]>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.verses = await this.prisma.quranVerse.findMany({
      orderBy: { id: "asc" },
    });
    if (!this.verses.length) return; // Not seeded yet; endpoints will 400.

    this.byId = new Map(this.verses.map((v) => [v.id, v]));
    this.index = buildQuranIndex(this.verses);

    this.pageVerses.clear();
    this.hizbVerses.clear();
    for (const verse of this.verses) {
      // A verse whose page is stored as "85-86" is printed on both pages, so it
      // must show up when either page is requested.
      for (const page of verse.page.split("-")) {
        const bucket = this.pageVerses.get(page);
        if (bucket) bucket.push(verse.id);
        else this.pageVerses.set(page, [verse.id]);
      }

      const hizb = this.hizbVerses.get(verse.hizbNumber);
      if (hizb) hizb.push(verse.id);
      else this.hizbVerses.set(verse.hizbNumber, [verse.id]);
    }
  }

  private ready(): void {
    if (!this.verses.length) {
      throw new BadRequestException("لم يتم تحميل المصحف بعد (شغّل seed)");
    }
  }

  getIndex(): QuranIndex {
    this.ready();
    return this.index;
  }

  get lastVerseId(): number {
    this.ready();
    return this.index.lastVerseId;
  }

  getVerse(id: number): QuranVerse {
    this.ready();
    const verse = this.byId.get(id);
    if (!verse) throw new BadRequestException(`الآية ${id} غير موجودة`);
    return verse;
  }

  /** Inclusive slice of the mushaf. */
  getRange(startVerseId: number, endVerseId: number): QuranVerse[] {
    this.ready();
    if (endVerseId < startVerseId) {
      throw new BadRequestException("نهاية النطاق قبل بدايته");
    }
    return this.verses.filter((v) => v.id >= startVerseId && v.id <= endVerseId);
  }

  /** All verses printed on one mushaf page. */
  getPage(page: string): QuranVerse[] {
    this.ready();
    const ids = this.pageVerses.get(page);
    if (!ids?.length) throw new BadRequestException(`الصفحة ${page} غير موجودة`);
    return ids.map((id) => this.getVerse(id));
  }

  listSurahs() {
    this.ready();
    return Object.values(this.index.byNumber)
      .sort((a, b) => a.number - b.number)
      .map(({ number, nameAr, firstVerseId, lastVerseId }) => ({
        number,
        nameAr,
        firstVerseId,
        lastVerseId,
        ayahCount: Object.keys(this.index.byNumber[number].ayahToVerseId).length,
      }));
  }

  parseScope(raw: string): ParsedScope {
    this.ready();
    return parseScope(raw, this.index);
  }

  /**
   * Where a passage that starts at `startVerseId` ends, given how much is to be
   * recited. Never runs past `maxVerseId` (the candidate's scope) or the mushaf.
   *
   * Length is measured in mushaf *lines* from the start verse, not in page
   * boundaries: a question drawn on the last line of a page must still be a full
   * wajh of recitation, not one ayah.
   */
  resolvePassageEnd(
    startVerseId: number,
    unit: AmountUnit,
    value: number,
    maxVerseId?: number,
  ): number {
    this.ready();
    if (value < 1) throw new BadRequestException("المقدار يجب أن يكون 1 فأكثر");

    const start = this.getVerse(startVerseId);
    const ceiling = Math.min(
      maxVerseId ?? this.index.lastVerseId,
      this.index.lastVerseId,
    );

    // Verse count is the one unit that is not measured in lines.
    if (unit === "ayat") {
      return Math.min(startVerseId + value - 1, ceiling);
    }

    let lines: number;
    switch (unit) {
      // A wajh is one printed face, i.e. one page of the mushaf.
      case "wajh":
      case "page":
        lines = LINES_PER_PAGE * value;
        break;
      case "rub_hizb":
        lines = this.hizbFractionLines(start, RUBS_PER_HIZB) * value;
        break;
      case "thumn_hizb":
        lines = this.hizbFractionLines(start, THUMNS_PER_HIZB) * value;
        break;
      default:
        throw new BadRequestException(`وحدة غير معروفة: ${unit}`);
    }

    return Math.min(this.endAfterLines(start, lines), ceiling);
  }

  /**
   * Absolute line ordinal of a verse's first line across the whole mushaf.
   *
   * Four long verses straddle a page break and store `page` as a range such as
   * "85-86"; they begin on the first of the two, so that is the number we take.
   * `Number("85-86")` would be NaN and poison every comparison downstream.
   */
  private absoluteLine(verse: QuranVerse): number {
    const firstPage = Number.parseInt(verse.page, 10);
    return (firstPage - 1) * LINES_PER_PAGE + verse.lineStart;
  }

  /**
   * The last verse that begins within `lines` lines of the start verse. Always
   * returns at least the start verse itself.
   */
  private endAfterLines(start: QuranVerse, lines: number): number {
    const cutoff = this.absoluteLine(start) + Math.max(1, Math.round(lines)) - 1;

    let end = start.id;
    for (let id = start.id + 1; id <= this.index.lastVerseId; id++) {
      const verse = this.byId.get(id);
      if (!verse || this.absoluteLine(verse) > cutoff) break;
      end = id;
    }
    return end;
  }

  /**
   * How many lines one rubʿ/thumn of the start verse's hizb spans. The dataset
   * carries no thumn markers, so the hizb's own line span is divided evenly —
   * accurate enough to size a passage, and the judge reads the real text anyway.
   */
  private hizbFractionLines(start: QuranVerse, fractionsPerHizb: number): number {
    const ids = this.hizbVerses.get(start.hizbNumber);
    if (!ids?.length) return LINES_PER_PAGE;

    const first = this.byId.get(ids[0]);
    const last = this.byId.get(ids[ids.length - 1]);
    if (!first || !last) return LINES_PER_PAGE;

    const span = this.absoluteLine(last) - this.absoluteLine(first) + 1;
    return Math.max(1, span / fractionsPerHizb);
  }
}
