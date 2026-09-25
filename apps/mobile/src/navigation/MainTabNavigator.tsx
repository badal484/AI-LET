import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/explore/HomeScreen.js';
import { ConversationsScreen } from '../screens/conversations/ConversationsScreen.js';
import { PaywallScreen } from '../screens/subscription/PaywallScreen.js';
import { ProfileScreen } from '../screens/profile/ProfileScreen.js';
import type { MainTabParamList } from './types.js';
import { Icon } from '../components/common/Icon.js';
const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0E0A17',
          borderTopColor: '#1F1730',
          borderTopWidth: 1,
          elevation: 0,
          height: 62,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#7A7288',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: -2,
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
        name="Conversations"
        component={ConversationsScreen}
        options={{
          tabBarLabel: 'Chats',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              <Icon name="chat" size={22} color={color} focused={focused} />
              <View style={styles.unreadDot} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="BuyPro"
        component={PaywallScreen}
        options={{
          tabBarLabel: 'Buy Pro',
          tabBarIcon: ({ color, focused }) => (
            <Icon name="diamond" size={21} color={color} focused={focused} />
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

const styles = StyleSheet.create({
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F43F5E',
    borderWidth: 1.5,
    borderColor: '#0E0A17',
  },
});

