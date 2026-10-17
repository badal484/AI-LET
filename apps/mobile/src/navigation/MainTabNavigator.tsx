import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeScreen } from '../screens/explore/HomeScreen.js';
import { ConversationsScreen } from '../screens/conversations/ConversationsScreen.js';
import { PaywallScreen } from '../screens/subscription/PaywallScreen.js';
import { ProfileScreen } from '../screens/profile/ProfileScreen.js';
import type { MainTabParamList } from './types.js';
import { Icon, IconName } from '../components/common/Icon.js';
import { useUnreadChats } from '../services/realtime/useUnreadChats.js';

const Tab = createBottomTabNavigator<MainTabParamList>();

const CustomTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const unreadChats = useUnreadChats();

  return (
    <View
      style={[
        styles.tabBarContainer,
        { paddingBottom: Math.max(insets.bottom, 6) },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        let iconName: IconName = 'home';
        let label = 'Home';

        if (route.name === 'Home') {
          iconName = 'home';
          label = 'Home';
        } else if (route.name === 'Conversations') {
          iconName = 'chat';
          label = 'Chats';
        } else if (route.name === 'BuyPro') {
          iconName = 'diamond';
          label = 'Buy Pro';
        } else if (route.name === 'Profile') {
          iconName = 'user';
          label = 'Profile';
        }

        const activeColor = isFocused ? '#FFFFFF' : '#5E5A6E';
        const activeIconColor = isFocused ? (route.name === 'Conversations' ? '#E11D48' : '#FFFFFF') : '#5E5A6E';

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            style={styles.tabButton}
            activeOpacity={0.75}
          >
            <View style={styles.iconWrapper}>
              <Icon name={iconName} size={22} color={activeIconColor} focused={isFocused} />

              {/* Chats with unread messages (live), like WhatsApp */}
              {route.name === 'Conversations' && unreadChats > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadChats > 99 ? '99+' : unreadChats}</Text>
                </View>
              )}
            </View>

            <Text
              style={[
                styles.tabLabel,
                { color: activeColor },
                isFocused && styles.activeLabelFont,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
      initialRouteName="Conversations"
      // Hide inactive tabs completely instead of "detaching" them. Detached tabs could stay touchable under the
      // visible one (RN 0.87 + Fabric): tapping a chat on Chats hit the Home card in the same spot and opened
      // the wrong character. Four tabs stay mounted, which also makes switching back instant.
      detachInactiveScreens={false}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Conversations" component={ConversationsScreen} />
      <Tab.Screen name="BuyPro" component={PaywallScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#07060B',
    borderTopWidth: 1,
    borderTopColor: '#161422',
    paddingTop: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
  },
  unreadBadge: {
    position: 'absolute',
    top: -6,
    right: -12,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: '#E11D48',
    borderWidth: 1.5,
    borderColor: '#07060B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 3,
  },
  activeLabelFont: {
    fontWeight: '700',
  },
});



