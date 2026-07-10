import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { toDisplayDigits } from "@tahkeem/shared";
import { colors, fonts, radius, spacing } from "../theme";
import type { PageVerse, QuestionPage } from "../types";

const FONT_SIZE = 26;
const LINE_HEIGHT = Math.round(FONT_SIZE * 2.1);

/** At-Tawba (9) opens without a basmala; every other surah carries one. */
const BASMALA = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";

/** A run of consecutive verses that share a surah, so a band can precede it. */
interface SurahBlock {
  suraNumber: number;
  suraNameAr: string;
  withBand: boolean;
  verses: PageVerse[];
}

function groupBySurah(verses: PageVerse[]): SurahBlock[] {
  const blocks: SurahBlock[] = [];
  for (const verse of verses) {
    const last = blocks[blocks.length - 1];
    if (last && last.suraNumber === verse.suraNumber) {
      last.verses.push(verse);
    } else {
      blocks.push({
        suraNumber: verse.suraNumber,
        suraNameAr: verse.suraNameAr,
        withBand: verse.startsSurah,
        verses: [verse],
      });
    }
  }
  return blocks;
}

/**
 * The full mushaf page(s) the question sits on, rendered as printed: the whole
 * page's verses on ruled lines in the Qaloun font, with the question shaded from
 * its first verse to its last, and a decorated band wherever a surah opens.
 *
 * Verses render as one continuous `<Text>` per surah block so the Arabic shapes
 * and wraps like paper. Each `ayaText` already ends with the mushaf's ornate
 * ayah-number glyph, so no separate number is drawn.
 */
export function MushafPanel({ page }: { page: QuestionPage }) {
  const first = page.verses[0];
  const pagesLabel = page.pages.map((p) => toDisplayDigits(p)).join(" · ");
  const blocks = groupBySurah(page.verses);

  const [contentHeight, setContentHeight] = useState(0);
  const ruleCount = Math.max(1, Math.ceil(contentHeight / LINE_HEIGHT));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerText} numberOfLines={1}>
          {first ? `الجزء ${toDisplayDigits(first.jozz)}` : ""}
          {first ? `  ·  الحزب ${toDisplayDigits(first.hizbNumber)}` : ""}
          {pagesLabel ? `  ·  صفحة ${pagesLabel}` : ""}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={styles.page}
          onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
        >
          {/* Ruled lines behind the text. */}
          <View style={styles.rules} pointerEvents="none">
            {Array.from({ length: ruleCount }, (_, i) => (
              <View key={i} style={styles.rule} />
            ))}
          </View>

          {blocks.map((block, i) => (
            <View key={`${block.suraNumber}-${i}`}>
              {block.withBand ? (
                <SurahBand
                  name={block.suraNameAr}
                  showBasmala={block.suraNumber !== 9 && block.suraNumber !== 1}
                />
              ) : null}
              <Text style={styles.verseText} allowFontScaling={false}>
                {block.verses.map((verse) => (
                  <Text
                    key={verse.id}
                    style={verse.highlighted ? styles.highlight : undefined}
                  >
                    {verse.ayaText}{" "}
                  </Text>
                ))}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function SurahBand({ name, showBasmala }: { name: string; showBasmala: boolean }) {
  return (
    <View style={styles.band}>
      <View style={styles.bandFrame}>
        <Text style={styles.bandFlourish}>﴾</Text>
        <Text style={styles.bandName} allowFontScaling={false}>
          {name}
        </Text>
        <Text style={styles.bandFlourish}>﴿</Text>
      </View>
      {showBasmala ? (
        <Text style={styles.basmala} allowFontScaling={false}>
          {BASMALA}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.mushafPaper,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: "hidden",
  },
  header: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceContainerLow,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  headerText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onSurfaceVariant,
    textAlign: "center",
  },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  page: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  rules: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  rule: {
    height: LINE_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
    opacity: 0.5,
  },
  verseText: {
    fontFamily: fonts.mushaf,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    color: colors.onSurface,
    textAlign: "center",
    writingDirection: "rtl",
  },
  highlight: {
    // A soft wash marks the question span within the page.
    backgroundColor: colors.primaryFixed,
    color: colors.onPrimaryContainer,
  },
  band: {
    alignItems: "center",
    marginVertical: spacing.sm,
  },
  bandFrame: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    alignSelf: "center",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceContainerLow,
  },
  bandName: {
    fontFamily: fonts.mushaf,
    fontSize: 22,
    color: colors.primary,
    textAlign: "center",
  },
  bandFlourish: { fontSize: 20, color: colors.primary },
  basmala: {
    fontFamily: fonts.mushaf,
    fontSize: FONT_SIZE - 4,
    lineHeight: LINE_HEIGHT,
    color: colors.onSurface,
    textAlign: "center",
    marginTop: spacing.xs,
  },
});
