import React from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Icon } from './Icon.js';
import { darkThemeColors, spacing, radius } from '../../theme/index.js';

export interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
  containerStyle?: ViewStyle;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChangeText,
  placeholder = 'Search companions, genres, traits...',
  autoFocus = false,
  onSubmitEditing,
  containerStyle,
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      <Icon name="search" size={18} color={darkThemeColors.textMuted} style={{ marginRight: spacing.sm }} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={darkThemeColors.textMuted}
        value={value}
        onChangeText={onChangeText}
        autoFocus={autoFocus}
        returnKeyType="search"
        onSubmitEditing={onSubmitEditing}
        selectionColor={darkThemeColors.accent}
        accessibilityRole="search"
        accessibilityLabel="Search companions"
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChangeText('')}
          style={styles.clearButton}
          accessibilityLabel="Clear search text"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="close" size={14} color={darkThemeColors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: darkThemeColors.surfaceElevated,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    height: 48,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: darkThemeColors.textPrimary,
    height: '100%',
  },
  clearButton: {
    padding: spacing.xs,
  },
  clearIcon: {
    color: darkThemeColors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
});
