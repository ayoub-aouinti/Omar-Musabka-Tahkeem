# منصة تحكيم المسابقات القرآنية

Judging platform for the Quran memorisation competitions of the **عمر بن الخطاب** local branch, دار شعبان الفهري.

- **`apps/api`** — NestJS + PostgreSQL (Prisma). The single source of truth for scoring.
- **`apps/web`** — React admin dashboard (competitions, candidates, judges, QR issuance, settings, results).
- **`apps/mobile`** — Expo app for judges (QR login, candidate list, mushaf, scoring panel).
- **`packages/shared`** — the scoring engine, the scope parser, and the Arabic normaliser. Imported by all three, so the judge's phone and the server compute a score with the same code. It builds twice: CommonJS (`dist/cjs`, for Nest and Metro) and ESM (`dist/esm`, for Vite). Vite reads the ESM build directly, so a rebuilt `dist/` is never shadowed by a stale pre-bundled CJS chunk.

Numbers are rendered in Western digits (`1 2 3`) everywhere. Every number the UI prints goes through `toDisplayDigits()` in `packages/shared`, so switching the whole product to Arabic-Indic is a one-line change.

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

### The tajweed rubric (2025), scored by category

The general criteria are the branch's four تجويد dimensions, transcribed from «معايير التقييم — المسابقة المحلية 2025»:

| المعيار | دون 30 حزبًا | 30 فما فوق |
|---|---|---|
| الغنن والمدود | /10 | /8 |
| المخارج والصفات | /16 | /10 |
| الوقف والابتداء | /5 | /3 |
| حسن الأداء | /5 | /5 |

Each criterion carries **scales** (one per band of أحزاب) and each scale carries descriptive **bands** — the guidance a judge reads before choosing a number (e.g. 8–10 «إتيان الطالب على جميع مواضع الغنن والمدود مع احترام الأزمنة»). The API resolves the ceiling and bands to the candidate's category, so a judge scoring a «دون 30» reciter sees /16 for المخارج and a «فوق 30» reciter sees /10. Everything — scales, bands, maxima, weights — is editable in **إعدادات التقييم**, and frozen once a result is submitted.

### Assigning judges to candidates

Beyond the category seat, a judge can be assigned to a **specific group of candidates**, and a candidate to **several judges** (`POST /candidates/:id/judges`, or bulk `POST /candidates/assign-judge`). **A direct assignment overrides the category:** once a candidate has any explicit judge, only those judges see and score them; a candidate with none stays open to everyone seated on their category. The dashboard badges candidates that have explicit judges.

### بنك الأسئلة

The dashboard's **بنك الأسئلة** lists every question in a competition — the papers auto-drawn per candidate and the hand-entered ones alike — filterable by category, candidate, difficulty (سهل/متوسط/صعب) and source. A question is editable (start verse, amount, difficulty) and new ones can be added, each shown against the **mushaf page on the left with the passage highlighted in soft grey**, the surah/ayah selection moving the highlight live.

### خاصّة vs عامّة — how a judge scores

The criteria split in two, and so does the judging flow:

- **المعايير الخاصّة (الحفظ)** are scored **per question**. On each question's sheet the judge taps تلعثم/تنبيه/فتح/ملغى, then either **حفظ كمسودّة** (tallies persist, `confirmed = false`) or **اعتماد تقييم السؤال** (`confirmed = true`, advances to the next).
- **المعايير العامّة (تجويد، صوت)** are scored **once, after the last question**, in the final sheet — together with **اعتماد النتيجة النهائية**.

Finalising is refused until *every* question is confirmed and *every* general criterion is scored, so a question can never be silently counted as flawless. Confirmation is stored (`QuestionResult.confirmed`), so a judge who closes the app resumes with exactly the questions they had locked in.

### The mushaf page

The judging screen shows the **full mushaf page(s)** the question sits on — the whole page as printed, on faint ruled lines in the Qaloun font — with the question **highlighted from its first verse to its last** in a soft grey wash. Where a surah opens on the page, the KFGQPC illuminated header band (`assets/surah-frame.png`) carries «سُورَةُ {name}» in its cartouche, followed by the basmala (except At-Tawba). Each `ayaText` already ends with the mushaf's ornate ayah-number glyph, so no number is drawn twice.

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

Judges have no password. An admin issues a temporary card for a competition, carrying two equivalent secrets:

| | What it is | Entropy |
|---|---|---|
| **QR code** | a 256-bit token | unguessable |
| **رمز التحقّق** | 8 characters, `ABCD-EFGH` | ~10¹² |

Only SHA-256 hashes are stored, so a database leak cannot be replayed. Redeeming **either** secret retires the whole card — `consumedAt` is stamped under a conditional update, so two phones racing the same card cannot both win.

The typed code is short enough to be worth guessing, so it leans on three defences together: the card is single-use, it expires within hours, and the API caps attempts at 6 per client per 15 minutes. Lengthening the expiry without revisiting that trade-off would be a mistake.

The code's alphabet omits `0 O 1 I L`. A character outside the alphabet is **rejected**, never remapped: an `O` could be a misread `Q` or `D`, and guessing would burn the single use on the wrong code.

Issuing a new card revokes the judge's previous live one, and the JWT never outlives the card that minted it.

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

> **Mobile on a real phone.** The app targets **Expo SDK 54** (RN 0.81, React 19, new architecture), which is what the current Expo Go installs. You do **not** need to configure the API URL: the app reads the host that served the Expo bundle and talks to `http://<that-host>:3001/api`. (`localhost` on a phone means the phone.) Set `EXPO_PUBLIC_API_URL` only to point a build at a fixed server. Make sure the API is running and your firewall lets the phone reach port 3001.

> **React majors differ on purpose.** `apps/mobile` is on React 19 (required by SDK 54); `apps/web` stays on React 18. Both `@types/react` majors therefore live in the pnpm store, and a dependency's own `.d.ts` resolves from inside the virtual store — so `apps/web/tsconfig.json` pins `paths` for `react`/`react-dom`. Without it, react-router's types bind to the React 19 typings and every `<Route>` becomes a type error. Web's `@types/react` is pinned exactly (18.3.12): 18.3.2x changed `ReactElement<P = unknown>` and breaks react-router 6.

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
