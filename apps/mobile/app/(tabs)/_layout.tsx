import React from "react";
import { Text } from "react-native";
import { Tabs } from "expo-router";
import { colors } from "../../src/theme";

function TabGlyph({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={{ fontSize: 22, color }}>{glyph}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.outline,
        tabBarStyle: {
          backgroundColor: colors.surfaceContainerLowest,
          borderTopColor: colors.outlineVariant,
          height: 60,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "المتسابقون",
          tabBarIcon: ({ color }) => <TabGlyph glyph="👥" color={color} />,
        }}
      />
      <Tabs.Screen
        name="active"
        options={{
          title: "التحكيم",
          tabBarIcon: ({ color }) => <TabGlyph glyph="📝" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "الإعدادات",
          tabBarIcon: ({ color }) => <TabGlyph glyph="⚙️" color={color} />,
        }}
      />
    </Tabs>
  );
}
