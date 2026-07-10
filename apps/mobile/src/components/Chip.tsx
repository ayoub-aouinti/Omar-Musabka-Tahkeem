import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radius, spacing } from "../theme";

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
}

/** A pill. Interactive when `onPress` is given, otherwise a static badge. */
export function Chip({
  label,
  selected = false,
  onPress,
  color,
  textColor,
  style,
}: ChipProps) {
  const bg = selected
    ? colors.primary
    : color ?? colors.surfaceContainerHigh;
  const fg = selected
    ? colors.onPrimary
    : textColor ?? colors.onSurfaceVariant;

  const content = (
    <View
      style={[
        styles.chip,
        { backgroundColor: bg, borderColor: selected ? colors.primary : "transparent" },
        style,
      ]}
    >
      <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    writingDirection: "rtl",
  },
});
