import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { colors, spacing } from "../theme";
import { toDisplayDigits } from "../lib/format";

interface ScoreSliderProps {
  value: number;
  onChange: (next: number) => void;
  /** Upper bound of the criterion (its resolved maxPoints). */
  max: number;
  /** Quarter-point granularity by default: 0, 0.25, 0.5, 0.75, 1, … */
  step?: number;
  disabled?: boolean;
}

const round2 = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * A 0..max slider for rating a تجويد / عامّة criterion in quarter-point steps.
 * Replaces the −/+ counter so judges can land on 0.25 / 0.5 / 0.75 quickly.
 * `onValueChange` gives live feedback while dragging; `onSlidingComplete`
 * guarantees the value is committed on release — including a deliberate 0.
 */
export function ScoreSlider({
  value,
  onChange,
  max,
  step = 0.25,
  disabled = false,
}: ScoreSliderProps) {
  return (
    <View style={styles.wrap}>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={(v) => onChange(round2(v))}
        onSlidingComplete={(v) => onChange(round2(v))}
        disabled={disabled}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.surfaceContainerHigh}
        thumbTintColor={colors.primary}
      />
      <View style={styles.ends}>
        <Text style={styles.end}>{toDisplayDigits(0)}</Text>
        <Text style={styles.end}>{toDisplayDigits(max)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", gap: 2 },
  slider: { width: "100%", height: 40 },
  ends: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs,
  },
  end: { fontSize: 12, color: colors.onSurfaceVariant },
});
