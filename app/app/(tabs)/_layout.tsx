import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../lib/theme';

type IconProps = { focused: boolean; emoji: string; label: string };

function TabIcon({ focused, emoji, label }: IconProps) {
  return (
    <View style={styles.tabIcon}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} emoji="🏠" label="Home" />
          ),
        }}
      />
      <Tabs.Screen
        name="items"
        options={{
          title: 'My Items',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} emoji="📦" label="Items" />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} emoji="🔔" label="Alerts" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} emoji="👤" label="Profile" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.tabBar,
    borderTopColor: colors.tabBarBorder,
    borderTopWidth: 1,
    height: 72,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  emoji: {
    fontSize: 22,
  },
  tabLabel: {
    fontSize: 10,
    color: colors.tabIconInactive,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: colors.tabIconActive,
    fontWeight: '700',
  },
});
