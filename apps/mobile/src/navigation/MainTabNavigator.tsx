import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeScreen } from '../screens/explore/HomeScreen.js';
import { ConversationsScreen } from '../screens/conversations/ConversationsScreen.js';
import { PremiumTabScreen } from '../screens/subscription/PremiumTabScreen.js';
import { ProfileScreen } from '../screens/profile/ProfileScreen.js';
import type { MainTabParamList } from './types.js';
import { Icon, IconName } from '../components/common/Icon.js';
import { useUnreadChats } from '../services/realtime/useUnreadChats.js';
import { tapFeedback, useReduceMotion } from '../utils/motion.js';

const ACTIVE = '#C4A5FF';
const INACTIVE = '#6B6680';

/** The tab's icon springs a little when the tab becomes active; the unread badge pops in when it appears. */
const TabIcon: React.FC<{ name: IconName; focused: boolean; badge: number }> = ({ name, focused, badge }) => {
  const reduceMotion = useReduceMotion();
  const pop = useRef(new Animated.Value(1)).current;
  const badgeScale = useRef(new Animated.Value(badge > 0 ? 1 : 0)).current;
  useEffect(() => {
    if (!focused || reduceMotion) return;
    pop.setValue(0.82);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 12 }).start();
  }, [focused, pop, reduceMotion]);
  useEffect(() => {
    const to = badge > 0 ? 1 : 0;
    if (reduceMotion) badgeScale.setValue(to);
    else Animated.spring(badgeScale, { toValue: to, useNativeDriver: true, speed: 16, bounciness: 10 }).start();
  }, [badge, badgeScale, reduceMotion]);
  return (
    <View style={styles.iconWrapper}>
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        <Icon name={name} size={23} color={focused ? ACTIVE : INACTIVE} focused={focused} />
      </Animated.View>
      {/* Chats with unread messages (live), like WhatsApp */}
      <Animated.View style={[styles.unreadBadge, { transform: [{ scale: badgeScale }] }]} pointerEvents="none">
        {badge > 0 && <Text style={styles.unreadBadgeText}>{badge > 99 ? '99+' : badge}</Text>}
      </Animated.View>
    </View>
  );
};

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
      <View style={styles.tabBarInner}>
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
              tapFeedback();
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
            label = 'Premium';
          } else if (route.name === 'Profile') {
            iconName = 'user';
            label = 'Profile';
          }

          const activeColor = isFocused ? '#FFFFFF' : INACTIVE;

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
              <TabIcon name={iconName} focused={isFocused} badge={route.name === 'Conversations' ? unreadChats : 0} />

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
    </View>
  );
};

export const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
      // Open on Home: a new user sees the characters (not an empty Chats), and Home's "Continue with X" card
      // takes a returning user back to their latest chat in one tap.
      initialRouteName="Home"
      // Hide inactive tabs completely instead of "detaching" them. Detached tabs could stay touchable under the
      // visible one (RN 0.87 + Fabric): tapping a chat on Chats hit the Home card in the same spot and opened
      // the wrong character. Four tabs stay mounted, which also makes switching back instant.
      detachInactiveScreens={false}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Conversations" component={ConversationsScreen} />
      <Tab.Screen name="BuyPro" component={PremiumTabScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    backgroundColor: '#07060B',
    borderTopWidth: 1,
    borderTopColor: '#161422',
    paddingTop: 8,
  },
  tabBarInner: {
    flexDirection: 'row',
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
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



