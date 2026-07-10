# منصة تحكيم المسابقات القرآنية

Judging platform for the Quran memorisation competitions of the **عمر بن الخطاب** local branch, دار شعبان الفهري.

- **`apps/api`** — NestJS + PostgreSQL (Prisma). The single source of truth for scoring.
- **`apps/web`** — React admin dashboard (competitions, candidates, judges, QR issuance, settings, results).
- **`apps/mobile`** — Expo app for judges (QR login, candidate list, mushaf, scoring panel).
- **`packages/shared`** — the scoring engine, the scope parser, and the Arabic normaliser. Imported by all three, so the judge's phone and the server compute a score with the same code.

---

## The scoring rule

Transcribed from the `المعايير` sheet of the branch's own workbook:

```
عدد الحفظ = 60 − ( ملغى × عدد السؤال + فتح × 1.5 + تنبيه × 0.75 + تلعثم × 0.25 )
```

| Term | Meaning | Deduction |
|---|---|---|
| `تلعثم` | the reciter stumbles but recovers unaided | 0.25 |
| `تنبيه` | the judge prompts with a hint | 0.75 |
| `فتح` | the judge supplies the word outright | 1.50 |
| `ملغى` | the question is written off | one whole question's value |

A question is worth `hifzBase ÷ questionCount` (60 ÷ 4 = 15 by default), so cancelling one costs 15 points. A cancelled question is *not* also charged for its stumbles.

The base (60) and the three weights live in the database per competition and are editable in **الإعدادات**. Additional criteria the judge rates directly — `التجويد` /30 and `الأداء والصوت` /10 — are added on top, giving 100. Once any result is submitted the configuration freezes, so a late edit to a weight can never silently rewrite a published score.

## The memorisation scope

Each candidate declares their range as free Arabic text in the `السّور المشارك بها` column. All 45 distinct forms in the 2026 workbook parse, including:

| Form | Example |
|---|---|
| surah → surah | `من النبأ إلى الناس` |
| trailing ayah | `من التّوبة 93 إلى النّاس` |
| parenthesised ayah | `من العنكبوت (اية 46) إلى النّاس` |
| a single surah | `سورة البقرة` |
| the whole mushaf | `كامل القرآن` |
| **written end-first** | `من الصافات الى البقرة` |

That last form is not a mistake: reciters who memorise backwards write the range end-first. The endpoints are reordered by mushaf position and the candidate is flagged `scopeReversed`.

Questions are then drawn *inside* that range. Draws are seeded (`competition.drawSeed` + the candidate id), so the same paper can be reprinted, and a passage is measured in mushaf **lines** — a question landing on the last line of a page still yields a full `وجه` of recitation.

## The judge's credential

An admin issues a judge a temporary account for a competition. The QR encodes a 256-bit token; only its SHA-256 hash is stored. It is **single-use** — the first scan stamps `consumedAt`, so a photographed card cannot be replayed — and issuing a new card revokes the judge's previous live one. The JWT it mints never outlives the card.

---

## Running it

Requires Node ≥ 20, pnpm 9, Docker.

```bash
pnpm install
pnpm shared:build          # the API and both apps import from dist/
pnpm db:up                 # Postgres 16 on host port 5433
cp apps/api/.env.example apps/api/.env
pnpm db:migrate
pnpm db:seed               # 6214 verses + the 2026 workbook
```

Or all of it at once: `pnpm bootstrap`.

Then, in separate terminals:

```bash
pnpm api:dev               # http://localhost:3001/api   (docs at /api/docs)
pnpm web:dev               # http://localhost:5173
pnpm mobile:dev            # Expo
```

Seeded administrator: `admin@omar-quran.tn` / `Admin@2026` (change `SEED_ADMIN_*` in `.env`).

> **Ports.** Postgres is published on **5433** and the API listens on **3001**, because 5432 and 3000 are frequently already taken on a developer machine. Change them in `docker-compose.yml` and `apps/api/.env` if you prefer.

> **Mobile on a real phone.** `EXPO_PUBLIC_API_URL` must be the machine's LAN address (`http://192.168.x.x:3001/api`), not `localhost`, and that address must be in the API's `CORS_ORIGINS`.

### What the seed loads

```
✔ Quran loaded (6214 verses, 114 surahs)
✔ Judges: 28
✔ Categories: 2, 3, 4, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60
✔ Candidates: 405 (6 declared their range end-first)
```

Sources: `apps/api/prisma/data/quran-qaloun-v2-1.json` (rivāyat Qālūn, with page/line/hizb metadata) and `apps/api/prisma/data/musabaqa-2026.xlsx`.

An admin can re-import a corrected workbook from the dashboard. `POST /imports/competitions/:id/workbook?dryRun=true` validates every row and reports what *would* happen — bad surah names, unknown categories, unparseable scopes — before anything is written.

## Tests

```bash
pnpm test                  # 71 unit tests: the scoring formula + all 45 scope strings
python scripts/smoke.py    # end-to-end against a running API + DB
```

The smoke test walks the real flow: admin login → issue a QR → judge scans it → open a session → submit tallies → confirm the score is `60 − (15 + 3 + 0.75 + 0.75) = 40.5`, that the QR cannot be replayed, that a submitted result is immutable, and that the scoring config is frozen once a result exists.

Per-workspace checks:

```bash
pnpm --filter @tahkeem/api  exec tsc --noEmit
pnpm --filter @tahkeem/web  build
pnpm --filter @tahkeem/mobile exec tsc --noEmit
```

## Known gaps

- **Judge panels are not gendered.** The seed seats all 28 judges on all 15 categories. The branch's judge list is split `رجال`/`نساء`, but categories are not gendered, so the separation has to be applied by editing seats in the dashboard. Enforcing it in the schema would mean gendering the category or the seat.
- **A password-login judge with seats in several competitions** must pass `?competitionId=`; the mobile app has no competition picker. With one competition (the normal case) it is inferred.
- `ثمن حزب` and `ربع حزب` passage sizes are derived by dividing each hizb's line span evenly, because the Qaloun dataset carries no thumn/rub markers. `وجه`, `صفحة` and `آيات` are exact.
