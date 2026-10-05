import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, touch } from '@bhojan/shared';
import { Icon, LoadingState, Screen, Text, type IconName } from '@/components';
import { useSession } from '@/lib/session';
import { useTheme } from '@/theme';

const TABS: Array<{ name: string; title: string; icon: IconName }> = [
  { name: 'index', title: 'Home', icon: 'home' },
  { name: 'meals', title: 'Meals', icon: 'meals' },
  { name: 'plans', title: 'Plans', icon: 'plans' },
  { name: 'me', title: 'Me', icon: 'me' },
];

export default function TabsLayout() {
  const { session, initializing } = useSession();
  const { reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();

  if (initializing) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (!session) return <Redirect href="/welcome" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: reduceMotion ? 'none' : 'fade',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          height: touch.tabBar + 8 + insets.bottom,
          paddingTop: spacing.xs,
          paddingBottom: Math.max(insets.bottom, spacing.xs),
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.title,
            tabBarIcon: ({ focused, color }) => (
              <View style={[styles.pill, focused && styles.pillActive]}>
                <Icon name={tab.icon} size={28} color={color as string} />
              </View>
            ),
            tabBarLabel: ({ focused, color }) => (
              <Text
                variant={focused ? 'label' : 'secondary'}
                style={{ color: color as string, fontSize: 16, lineHeight: 20 }}
                maxFontSizeMultiplier={1.4}
                numberOfLines={1}
              >
                {tab.title}
              </Text>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: 64,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: colors.primarySoft,
  },
});
