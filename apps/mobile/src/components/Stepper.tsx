import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { toArabicDigits } from "@tahkeem/shared";
import { colors, MIN_TOUCH, radius } from "../theme";

interface StepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** A −/+ counter with ≥48dp round targets. Value shown in Arabic-Indic digits. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  disabled = false,
  style,
}: StepperProps) {
  const dec = () => onChange(Math.max(min, round(value - step)));
  const inc = () => onChange(Math.min(max, round(value + step)));
  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <View style={[styles.row, style]}>
      <StepButton
        label="−"
        onPress={dec}
        disabled={disabled || atMin}
        accessibilityLabel="إنقاص"
      />
      <Text style={styles.value} accessibilityLabel={`القيمة ${value}`}>
        {toArabicDigits(trimZeros(value))}
      </Text>
      <StepButton
        label="+"
        onPress={inc}
        disabled={disabled || atMax}
        accessibilityLabel="زيادة"
      />
    </View>
  );
}

function StepButton({
  label,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={[styles.buttonLabel, disabled && styles.buttonLabelDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

function round(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function trimZeros(n: number): string {
  return String(round(n));
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  button: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryContainer,
  },
  buttonPressed: {
    backgroundColor: colors.primary,
  },
  buttonDisabled: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  buttonLabel: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  buttonLabelDisabled: {
    color: colors.outline,
  },
  value: {
    minWidth: 44,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "700",
    color: colors.onSurface,
  },
});
