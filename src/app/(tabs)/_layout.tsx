import { Tabs } from 'expo-router';
import { BookOpen, ChartNoAxesColumn, House } from 'lucide-react-native';

import { colors, typography } from '@/theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontFamily: typography.bengaliMedium,
          fontSize: 11,
          marginBottom: 4,
        },
        tabBarStyle: {
          height: 72,
          paddingTop: 8,
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'আজ',
          tabBarIcon: ({ color }) => <House color={color} size={23} />,
        }}
      />
      <Tabs.Screen
        name="quran"
        options={{
          title: 'কুরআন',
          tabBarIcon: ({ color }) => <BookOpen color={color} size={23} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'অগ্রগতি',
          tabBarIcon: ({ color }) => (
            <ChartNoAxesColumn color={color} size={23} />
          ),
        }}
      />
    </Tabs>
  );
}
