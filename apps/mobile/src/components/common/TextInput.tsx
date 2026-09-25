import React, { useState } from 'react';
import {
  View,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { darkThemeColors, spacing, radius } from '../../theme/index.js';
import { Icon } from './Icon.js';

export interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  clearable?: boolean;
  containerStyle?: ViewStyle;
}

export const TextInput: React.FC<TextInputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  clearable = false,
  containerStyle,
  value,
  onChangeText,
  style,
  onFocus,
  onBlur,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    if (onChangeText) {
      onChangeText('');
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          error ? styles.inputWrapperError : {},
        ]}
      >
        {leftIcon && <View style={styles.leftIconContainer}>{leftIcon}</View>}

        <RNTextInput
          style={[styles.input, style]}
          placeholderTextColor={darkThemeColors.textMuted}
          value={value}
          onChangeText={onChangeText}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          selectionColor={darkThemeColors.accent}
          {...rest}
        />

        {clearable && value && value.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClear}
            accessibilityLabel="Clear text"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="close" size={13} color={darkThemeColors.textMuted} />
          </TouchableOpacity>
        )}

        {rightIcon && <View style={styles.rightIconContainer}>{rightIcon}</View>}
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: darkThemeColors.textSecondary,
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: darkThemeColors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  inputWrapperFocused: {
    borderColor: darkThemeColors.accent,
  },
  inputWrapperError: {
    borderColor: darkThemeColors.danger,
  },
  input: {
    flex: 1,
    color: darkThemeColors.textPrimary,
    fontSize: 15,
    paddingVertical: spacing.sm,
  },
  leftIconContainer: {
    marginRight: spacing.sm,
  },
  rightIconContainer: {
    marginLeft: spacing.sm,
  },
  clearButton: {
    padding: spacing.xs,
  },
  clearIcon: {
    color: darkThemeColors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: darkThemeColors.danger,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  helperText: {
    color: darkThemeColors.textMuted,
    fontSize: 12,
    marginTop: spacing.xs,
  },
});
