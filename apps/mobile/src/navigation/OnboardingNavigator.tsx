import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen.js';
import { LanguageSelectScreen } from '../screens/onboarding/LanguageSelectScreen.js';
import { InterestsSelectScreen } from '../screens/onboarding/InterestsSelectScreen.js';
import { ConversationStyleScreen } from '../screens/onboarding/ConversationStyleScreen.js';
import { CharacterSelectionScreen } from '../screens/onboarding/CharacterSelectionScreen.js';
import { useOnboardingStore } from '../stores/onboardingStore.js';

export type OnboardingStackParamList = {
  Welcome: undefined;
  LanguageSelect: undefined;
  InterestsSelect: undefined;
  ConversationStyle: undefined;
  CharacterSelection: undefined;
};

const Stack = createStackNavigator<OnboardingStackParamList>();

export const OnboardingNavigator: React.FC = () => {
  const { currentStep } = useOnboardingStore();

  const getInitialRoute = (): keyof OnboardingStackParamList => {
    switch (currentStep) {
      case 'LANGUAGE':
        return 'LanguageSelect';
      case 'INTERESTS':
        return 'InterestsSelect';
      case 'STYLE':
        return 'ConversationStyle';
      case 'CHARACTER_SELECTION':
        return 'CharacterSelection';
      default:
        return 'Welcome';
    }
  };

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#090A0F' },
      }}
      initialRouteName={getInitialRoute()}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="LanguageSelect" component={LanguageSelectScreen} />
      <Stack.Screen name="InterestsSelect" component={InterestsSelectScreen} />
      <Stack.Screen name="ConversationStyle" component={ConversationStyleScreen} />
      <Stack.Screen name="CharacterSelection" component={CharacterSelectionScreen} />
    </Stack.Navigator>
  );
};
