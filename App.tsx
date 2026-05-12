import React, { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";

import DashboardScreen from "./src/screens/DashboardScreen";
import HistoryScreen from "./src/screens/HistoryScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import { setupNotifications } from "./src/notifications/setup";
import { registerBackgroundFetch } from "./src/tasks/backgroundFetch";
import { loadSettings } from "./src/storage/settings";
import { colors } from "./src/theme";

type TabParamList = {
  Dashboard: undefined;
  History: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

interface TabIconProps {
  icon: string;
  focused: boolean;
}

function TabIcon({ icon, focused }: TabIconProps) {
  return (
    <Text style={[styles.icon, focused && styles.iconActive]}>{icon}</Text>
  );
}

export default function App() {
  useEffect(() => {
    async function initialize() {
      try {
        await setupNotifications();
      } catch (error) {
        console.warn("Failed to setup notifications:", error);
      }

      try {
        const settings = await loadSettings();
        const hasAnyKey = Object.values(settings.providers).some((p) => p?.apiKey);
        if (hasAnyKey) {
          await registerBackgroundFetch(settings.defaultRefreshIntervalMin);
        }
      } catch (error) {
        console.warn("Failed to initialize background fetch:", error);
      }
    }

    initialize();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.surfaceBorder,
              borderTopWidth: 1,
              height: 60,
              paddingBottom: 8,
              paddingTop: 8,
              elevation: 0,
              shadowOpacity: 0,
            },
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarLabelStyle: {
              fontSize: 11,
            },
          }}
        >
          <Tab.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{
              tabBarLabel: "概览",
              tabBarIcon: ({ focused }) => (
                <TabIcon icon="⌂" focused={focused} />
              ),
            }}
          />
          <Tab.Screen
            name="History"
            component={HistoryScreen}
            options={{
              tabBarLabel: "历史",
              tabBarIcon: ({ focused }) => (
                <TabIcon icon="☰" focused={focused} />
              ),
            }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              tabBarLabel: "设置",
              tabBarIcon: ({ focused }) => (
                <TabIcon icon="⚙" focused={focused} />
              ),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 22,
    color: colors.textMuted,
  },
  iconActive: {
    color: colors.primary,
  },
});
