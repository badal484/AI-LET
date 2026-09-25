import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { darkThemeColors, spacing } from '../../theme/index.js';

export interface DividerProps {
  label?: string;
  marginVertical?: keyof typeof spacing;
  style?: ViewStyle;
}

export const Divider: React.FC<DividerProps> = ({
  label,
  marginVertical = 'md',
  style,
}) => {
  const mv = spacing[marginVertical];

  if (label) {
    return (
      <View style={[styles.labeledContainer, { marginVertical: mv }, style]}>
        <View style={styles.line} />
        <Text style={styles.label}>{label}</Text>
        <View style={styles.line} />
      </View>
    );
  }

  return <View style={[styles.line, { marginVertical: mv }, style]} />;
};

const styles = StyleSheet.create({
  line: {
    flex: 1,
    height: 1,
    backgroundColor: darkThemeColors.borderSubtle,
  },
  labeledContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  label: {
    paddingHorizontal: spacing.md,
    fontSize: 11,
    fontWeight: '600',
    color: darkThemeColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
