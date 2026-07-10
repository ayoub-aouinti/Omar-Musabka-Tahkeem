import { describe, expect, it } from "vitest";
import {
  ACCESS_CODE_ALPHABET,
  ACCESS_CODE_LENGTH,
  formatAccessCode,
  isAccessCodeShaped,
  normalizeAccessCode,
} from "../access-code";

describe("the access code alphabet", () => {
  it("excludes the glyphs judges misread on a printed card", () => {
    for (const confusable of ["0", "O", "1", "I", "L"]) {
      expect(ACCESS_CODE_ALPHABET).not.toContain(confusable);
    }
  });

  it("has no duplicates", () => {
    expect(new Set(ACCESS_CODE_ALPHABET).size).toBe(ACCESS_CODE_ALPHABET.length);
  });
});

describe("normalizeAccessCode", () => {
  it("accepts however the judge types it", () => {
    expect(normalizeAccessCode("abcd-efgh")).toBe("ABCDEFGH");
    expect(normalizeAccessCode("  ABCD EFGH ")).toBe("ABCDEFGH");
    expect(normalizeAccessCode("AB-CD--EF GH")).toBe("ABCDEFGH");
  });

  it("does not guess at look-alike glyphs", () => {
    // An `O` could be a misread Q or D; rewriting it would burn the single use
    // on the wrong code. It survives normalisation and then fails the shape test.
    expect(normalizeAccessCode("OOOO-OOOO")).toBe("OOOOOOOO");
    expect(isAccessCodeShaped("OOOO-OOOO")).toBe(false);
  });
});

describe("isAccessCodeShaped", () => {
  it("accepts a well-formed code in any casing", () => {
    expect(isAccessCodeShaped("XRKD-D2NT")).toBe(true);
    expect(isAccessCodeShaped("xrkdd2nt")).toBe(true);
  });

  it("rejects the wrong length", () => {
    expect(isAccessCodeShaped("XRKD-D2N")).toBe(false);
    expect(isAccessCodeShaped("XRKD-D2NTQ")).toBe(false);
  });

  it("rejects characters outside the alphabet", () => {
    expect(isAccessCodeShaped("XRKD-D2N0")).toBe(false); // zero
    expect(isAccessCodeShaped("XRKD-D2NI")).toBe(false); // capital i
  });
});

describe("formatAccessCode", () => {
  it("groups a full code as ABCD-EFGH", () => {
    expect(formatAccessCode("XRKDD2NT")).toBe("XRKD-D2NT");
    expect(formatAccessCode("xrkd d2nt")).toBe("XRKD-D2NT");
    expect(formatAccessCode("XRKD-D2NT")).toBe("XRKD-D2NT");
  });

  it("leaves a partial code ungrouped rather than inventing a dash", () => {
    expect(formatAccessCode("XRK")).toBe("XRK");
  });

  it("round-trips with normalizeAccessCode", () => {
    const code = "MNPQ-RS23";
    expect(normalizeAccessCode(formatAccessCode(code))).toHaveLength(
      ACCESS_CODE_LENGTH,
    );
  });
});
