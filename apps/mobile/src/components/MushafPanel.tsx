import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { toArabicDigits } from "@tahkeem/shared";
import { colors, fonts, radius, spacing } from "../theme";
import type { QuestionPassage } from "../types";

/**
 * A cream mushaf card: a header naming the juz' and surah, then the passage's
 * verses in the Qaloun font, each followed by its ayah number in a badge.
 */
export function MushafPanel({ passage }: { passage: QuestionPassage }) {
  const first = passage.verses[0];
  const pagesLabel = passage.pages.map((p) => toArabicDigits(p)).join(" · ");

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {first ? `الجزء ${toArabicDigits(first.jozz)}` : ""}
        </Text>
        <Text style={styles.headerDot}>·</Text>
        <Text style={styles.headerText}>
          {first ? `سورة ${first.suraNameAr.trim()}` : ""}
        </Text>
        {pagesLabel ? (
          <>
            <Text style={styles.headerDot}>·</Text>
            <Text style={styles.headerPages}>صفحة {pagesLabel}</Text>
          </>
        ) : null}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.passage}
        showsVerticalScrollIndicator
      >
        <View style={styles.flow}>
          {passage.verses.map((verse) => (
            <View key={verse.id} style={styles.verseChunk}>
              <Text style={styles.verseText}>{verse.ayaText} </Text>
              <View style={styles.ayaBadge}>
                <Text style={styles.ayaNumber}>
                  {toArabicDigits(verse.ayaNumber)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
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
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceContainerLow,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  headerText: { fontSize: 15, fontWeight: "700", color: colors.onPrimaryContainer },
  headerDot: { color: colors.outline, fontSize: 15 },
  headerPages: { fontSize: 13, color: colors.onSurfaceVariant },
  scroll: { flex: 1 },
  passage: { padding: spacing.lg },
  flow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
  },
  verseChunk: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  verseText: {
    fontFamily: fonts.mushaf,
    fontSize: 28,
    lineHeight: 28 * 2.2,
    color: colors.onSurface,
    textAlign: "center",
    writingDirection: "rtl",
  },
  ayaBadge: {
    minWidth: 30,
    height: 30,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    marginHorizontal: 4,
    backgroundColor: colors.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
  },
  ayaNumber: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.onPrimaryContainer,
  },
});
