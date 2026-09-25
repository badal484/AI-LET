import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/explore/HomeScreen.js';
import { SearchScreen } from '../screens/explore/SearchScreen.js';
import { ConversationsScreen } from '../screens/conversations/ConversationsScreen.js';
import { ProfileScreen } from '../screens/profile/ProfileScreen.js';
import type { MainTabParamList } from './types.js';
import { darkThemeColors } from '../theme/colors.js';
import { Icon } from '../components/common/Icon.js';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: darkThemeColors.surface,
          borderTopColor: darkThemeColors.borderSubtle,
          borderTopWidth: 1,
          elevation: 0,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: darkThemeColors.accent,
        tabBarInactiveTintColor: darkThemeColors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
      initialRouteName="Home"
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Icon name="home" size={22} color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Discover"
        component={SearchScreen}
        options={{
          tabBarLabel: 'Discover',
          tabBarIcon: ({ color, focused }) => (
            <Icon name="compass" size={22} color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Conversations"
        component={ConversationsScreen}
        options={{
          tabBarLabel: 'Messages',
          tabBarIcon: ({ color, focused }) => (
            <Icon name="chat" size={22} color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Icon name="user" size={22} color={color} focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};
