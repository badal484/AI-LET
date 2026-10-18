import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LanguageSelectScreen } from '../screens/onboarding/LanguageSelectScreen.js';

export type OnboardingStackParamList = {
  Welcome: undefined;
  LanguageSelect: undefined;
  InterestsSelect: undefined;
  ConversationStyle: undefined;
  CharacterSelection: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

/** One required screen — language and how to be addressed — then Home (owner's decision, 18 Oct 2026). */
export const OnboardingNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        // Native Android/iOS transitions (smooth, swipe back), same as system apps.
        animation: 'ios_from_right',
        contentStyle: { backgroundColor: '#090A0F' },
      }}
      initialRouteName="LanguageSelect"
    >
      <Stack.Screen name="LanguageSelect" component={LanguageSelectScreen} />
    </Stack.Navigator>
  );
};
