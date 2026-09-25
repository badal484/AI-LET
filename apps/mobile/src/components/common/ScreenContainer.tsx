import React from 'react';
import { View, StyleSheet, ViewProps, StatusBar } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { darkThemeColors } from '../../theme/index.js';

export interface ScreenContainerProps extends ViewProps {
  edges?: Edge[];
  children: React.ReactNode;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  edges = ['top', 'left', 'right', 'bottom'],
  style,
  children,
  ...rest
}) => {
  return (
    <SafeAreaView edges={edges} style={[styles.container, style]} {...rest}>
      <StatusBar barStyle="light-content" backgroundColor={darkThemeColors.background} />
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkThemeColors.background,
  },
  content: {
    flex: 1,
  },
});
