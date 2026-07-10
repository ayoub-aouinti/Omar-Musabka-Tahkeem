#!/usr/bin/env python3
"""End-to-end smoke test against a running API and a freshly seeded database.

    pnpm db:reset && pnpm api:dev      # in one terminal
    python scripts/smoke.py            # in another

Walks the real judging flow and asserts the invariants that matter:
the scoring formula, single-use QR credentials, immutable results, and a
scoring configuration that freezes once a result has been submitted.

Written in Python rather than curl+bash because the Windows shell mangles
Arabic query strings into cp1256.
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request

API = "http://localhost:3001/api"
ADMIN = {"email": "admin@omar-quran.tn", "password": "Admin@2026"}


class ApiError(Exception):
    def __init__(self, status: int, payload: dict):
        self.status = status
        self.payload = payload
        super().__init__(f"HTTP {status}: {payload.get('message')}")


def call(path, method="GET", body=None, token=None):
    request = urllib.request.Request(
        API + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
    )
    try:
        with urllib.request.urlopen(request) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise ApiError(error.code, json.load(error)) from None


passed = 0


def check(label: str, condition: bool, detail: str = "") -> None:
    global passed
    if not condition:
        print(f"  FAIL  {label}  {detail}")
        sys.exit(1)
    passed += 1
    print(f"  ok    {label}" + (f"  ({detail})" if detail else ""))


def expect_error(label: str, fn) -> None:
    try:
        fn()
    except ApiError as error:
        check(label, True, error.payload.get("message", ""))
        return
    print(f"  FAIL  {label}  (expected a rejection, got success)")
    sys.exit(1)


def main() -> None:
    if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8")

    print("\nauth")
    expect_error("unauthenticated request is rejected", lambda: call("/competitions"))
    # Long enough to clear the min-length validator, so this exercises auth itself.
    expect_error(
        "wrong password is rejected",
        lambda: call("/auth/login", "POST", {**ADMIN, "password": "definitely-not-it"}),
    )
    admin = call("/auth/login", "POST", ADMIN)
    token = admin["accessToken"]
    check("admin logs in", admin["user"]["role"] == "ADMIN")

    print("\ncompetition")
    competition = call("/competitions", token=token)[0]
    cid = competition["id"]
    check("competition seeded", competition["_count"]["candidates"] == 405, "405 candidates")

    scoring = call(f"/competitions/{cid}/scoring", token=token)
    check("hifz base is 60", scoring["hifzBase"] == 60)
    check(
        "penalty weights match the workbook",
        scoring["weights"] == {"talathum": 0.25, "tanbih": 0.75, "fath": 1.5},
        str(scoring["weights"]),
    )

    print("\nscope parsing")
    raw = urllib.parse.quote("من الصافات الى البقرة")
    scope = call(f"/quran/scope?raw={raw}", token=token)
    check("a backwards range is reordered", scope["reversed"] is True)
    check("and spans the right verses", scope["verseCount"] == 3957, f"{scope['verseCount']} verses")

    expect_error(
        "an unknown surah is rejected",
        lambda: call(f"/quran/scope?raw={urllib.parse.quote('من كذا إلى الناس')}", token=token),
    )

    print("\nquestion draw")
    candidate = call(f"/candidates?competitionId={cid}&take=1", token=token)["items"][0]
    kid = candidate["id"]

    first = call(f"/questions/candidate/{kid}/generate", "POST", {"regenerate": True}, token)
    # Regenerating replaces the rows, so `first`'s ids are gone — keep `paper`.
    paper = call(f"/questions/candidate/{kid}/generate", "POST", {"regenerate": True}, token)
    check("paper is drawn", len(first) == 4, f"{len(first)} questions")
    check(
        "and the draw is deterministic",
        [q["startVerseId"] for q in first] == [q["startVerseId"] for q in paper],
    )

    for question in paper:
        passage = call(f"/questions/{question['id']}/passage", token=token)
        verses = passage["verses"]
        start, end = verses[0], verses[-1]
        lines = (
            (int(str(end["page"]).split("-")[0]) - 1) * 15 + end["lineEnd"]
        ) - ((int(str(start["page"]).split("-")[0]) - 1) * 15 + start["lineStart"]) + 1
        # A wajh is 15 lines. The passage starts on the drawn verse's first line
        # and ends on its last verse's *last* line, so it can overshoot by the
        # length of that closing verse; and it is cut short where the candidate's
        # scope ends. The bound catches collapse-to-one-verse, not exact length.
        check(
            f"passage {question['sortOrder'] + 1} is a real wajh",
            2 <= lines <= 24,
            f"{lines} lines, {len(verses)} verses",
        )
        # Every drawn passage must lie inside the candidate's declared scope.
        check(
            f"passage {question['sortOrder'] + 1} stays inside the scope",
            question["startVerseId"] >= candidate["scopeStartVerseId"]
            and question["endVerseId"] <= candidate["scopeEndVerseId"],
        )

    print("\njudge credential")
    judges = call("/judges", token=token)
    judge = judges[0]
    access = call(
        f"/judges/{judge['id']}/access", "POST", {"competitionId": cid, "hours": 4}, token
    )
    check("QR issued", access["qrDataUrl"].startswith("data:image/png"), access["displayCode"])
    check(
        "verification code issued",
        len(access["accessCode"]) == 9 and access["accessCode"][4] == "-",
        access["accessCode"],
    )

    judge_auth = call("/auth/qr", "POST", {"token": access["token"]})
    jtoken = judge_auth["accessToken"]
    check("judge logs in by QR", judge_auth["user"]["role"] == "JUDGE")

    expect_error(
        "the same QR cannot be replayed",
        lambda: call("/auth/qr", "POST", {"token": access["token"]}),
    )
    expect_error(
        "redeeming the QR also burns its verification code",
        lambda: call("/auth/code", "POST", {"code": access["accessCode"]}),
    )
    expect_error("judge cannot reach admin routes", lambda: call("/judges", token=jtoken))

    print("\nverification code login")
    second = judges[1]
    card = call(
        f"/judges/{second['id']}/access", "POST", {"competitionId": cid, "hours": 4}, token
    )
    code = card["accessCode"]

    # The judge types it however they like: lower case, no dash, stray spaces.
    typed = f"  {code.replace('-', '').lower()} "
    coded_auth = call("/auth/code", "POST", {"code": typed})
    check("judge logs in by typed code", coded_auth["user"]["role"] == "JUDGE")
    check("and is bound to the competition", coded_auth["user"]["competitionId"] == cid)

    expect_error(
        "the code is single-use",
        lambda: call("/auth/code", "POST", {"code": code}),
    )
    expect_error(
        "and its QR token is burned with it",
        lambda: call("/auth/qr", "POST", {"token": card["token"]}),
    )

    print("\nbrute-force throttling")
    # MAX_CODE_ATTEMPTS = 6 within 15 minutes, counted per client.
    throttled = False
    for attempt in range(1, 12):
        try:
            call("/auth/code", "POST", {"code": "ZZZZ-ZZZZ"})
        except ApiError as error:
            if error.status == 429:
                check("guessing is throttled", True, f"after {attempt} attempts")
                throttled = True
                break
    check("throttle engaged before 12 guesses", throttled)

    print("\njudging")
    opened = call(f"/judging/sessions/{kid}/open", "POST", None, jtoken)
    sid = opened["session"]["id"]
    check("session opens", opened["scoring"]["pointsPerQuestion"] == 15, "60 / 4 questions")

    questions = [p["question"]["id"] for p in opened["questions"]]
    criteria = scoring["directCriteria"]

    # 1 cancelled (-15) + 2 fath (-3) + 1 tanbih (-0.75) + 3 talathum (-0.75) = -19.5
    payload = {
        "sessionId": sid,
        "questions": [
            {"questionId": questions[0], "talathumCount": 0, "tanbihCount": 0, "fathCount": 0, "cancelled": True},
            {"questionId": questions[1], "talathumCount": 0, "tanbihCount": 1, "fathCount": 2, "cancelled": False},
            {"questionId": questions[2], "talathumCount": 3, "tanbihCount": 0, "fathCount": 0, "cancelled": False},
            {"questionId": questions[3], "talathumCount": 0, "tanbihCount": 0, "fathCount": 0, "cancelled": False},
        ],
        "criterionScores": [
            {"criterionId": criteria[0]["id"], "value": 27},
            {"criterionId": criteria[1]["id"], "value": 8},
        ],
        "notes": "اختبار آلي",
        "finalize": True,
    }
    score = call("/judging/submit", "POST", payload, jtoken)["score"]
    hifz = score["hifz"]

    check("cancelled question costs its full value", hifz["cancelledPenalty"] == 15)
    check("fath is charged at 1.5", hifz["fathPenalty"] == 3.0)
    check("tanbih is charged at 0.75", hifz["tanbihPenalty"] == 0.75)
    check("talathum is charged at 0.25", hifz["talathumPenalty"] == 0.75)
    check("hifz = 60 - 19.5", hifz["score"] == 40.5, f"{hifz['score']} / 60")
    check("total = hifz + direct", score["total"] == 75.5, f"{score['total']} / {score['maxTotal']}")

    expect_error(
        "a submitted result is immutable",
        lambda: call(
            "/judging/submit", "POST",
            {"sessionId": sid, "questions": [], "criterionScores": [], "finalize": False},
            jtoken,
        ),
    )
    expect_error(
        "scoring config freezes once a result exists",
        lambda: call(
            f"/competitions/{cid}/scoring", "PUT",
            {
                "criteria": [{"key": "hifz", "labelAr": "الحفظ", "kind": "PENALTY", "maxPoints": 100}],
                "penaltyRules": [{"kind": "FATH", "labelAr": "فتح", "weight": 9}],
            },
            token,
        ),
    )

    ranking = call(f"/judging/results?competitionId={cid}", token=token)
    check("ranking reports the average", ranking[0]["averageScore"] == 75.5)

    print(f"\n{passed} checks passed\n")


if __name__ == "__main__":
    try:
        main()
    except ApiError as error:
        print(f"\nAPI error: {error}\n")
        sys.exit(1)
    except urllib.error.URLError:
        print(f"\nCannot reach {API} — is the API running? (pnpm api:dev)\n")
        sys.exit(1)
