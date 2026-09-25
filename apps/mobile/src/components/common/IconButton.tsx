import React from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  StyleSheet,
  ViewStyle,
  Text,
  ActivityIndicator,
} from 'react-native';
import { darkThemeColors, radius } from '../../theme/index.js';
import { Icon, IconName } from './Icon.js';

export interface IconButtonProps extends TouchableOpacityProps {
  icon: React.ReactNode | IconName | string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'surface' | 'glass' | 'accent' | 'danger' | 'ghost';
  iconColor?: string;
  isLoading?: boolean;
  accessibilityLabel: string;
  badgeCount?: number;
}

const EMOJI_TO_ICON: Record<string, IconName> = {
  '🔔': 'bell',
  '🔍': 'search',
  '💬': 'chat',
  '🎙️': 'mic',
  '🎙': 'mic',
  '🔇': 'mic-off',
  '🔊': 'speaker',
  '🔈': 'speaker-off',
  '📞': 'phone',
  '←': 'arrow-left',
  '‹': 'arrow-left',
  '→': 'arrow-right',
  '›': 'arrow-right',
  '✕': 'close',
  '✖': 'close',
  '↑': 'arrow-up',
  '⚠️': 'warning',
  '⚠': 'warning',
  '⚐': 'flag',
  '⚑': 'flag',
  '🗑': 'trash',
  '🗑️': 'trash',
  '⋯': 'more',
  '🧠': 'brain',
  '🎭': 'sparkles',
  '✨': 'sparkles',
  '⭐': 'star',
  '❤️': 'heart-filled',
  '🤍': 'heart',
  '+': 'plus',
  '✓': 'check',
  '🔒': 'lock',
  '🛡️': 'shield',
  '🛡': 'shield',
  '🌙': 'moon',
  '☕': 'coffee',
  '⚡': 'zap',
  '🚫': 'ban',
  '📚': 'book',
  '🎨': 'palette',
  '👍': 'thumbs-up',
  '👎': 'thumbs-down',
};

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  size = 'md',
  variant = 'surface',
  iconColor,
  isLoading = false,
  disabled,
  style,
  accessibilityLabel,
  badgeCount,
  ...rest
}) => {
  const isDisabled = disabled || isLoading;

  const sizeDimensions = {
    sm: { width: 36, height: 36, borderRadius: radius.md },
    md: { width: 44, height: 44, borderRadius: 22 }, // Standard 44dp touch target
    lg: { width: 52, height: 52, borderRadius: 26 },
  }[size];

  const iconSizes = {
    sm: 18,
    md: 22,
    lg: 26,
  }[size];

  const resolvedColor = iconColor || (
    variant === 'accent' ? '#000000' :
    variant === 'danger' ? '#ffffff' :
    darkThemeColors.textPrimary
  );

  const buttonStyles: ViewStyle[] = [
    styles.base,
    sizeDimensions,
    styles[variant],
    isDisabled ? styles.disabled : {},
    style as ViewStyle,
  ];

  const renderIconContent = () => {
    if (isLoading) {
      return <ActivityIndicator size="small" color={darkThemeColors.accent} />;
    }

    if (typeof icon === 'string') {
      const mappedName = EMOJI_TO_ICON[icon] || (icon as IconName);
      return <Icon name={mappedName as IconName} size={iconSizes} color={resolvedColor} />;
    }

    return icon;
  };

  return (
    <TouchableOpacity
      style={buttonStyles}
      disabled={isDisabled}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      {...rest}
    >
      {renderIconContent()}

      {typeof badgeCount === 'number' && badgeCount > 0 && (
        <TouchableOpacity style={styles.badge}>
          <Text style={styles.badgeText}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  surface: {
    backgroundColor: darkThemeColors.surfaceElevated,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  glass: {
    backgroundColor: darkThemeColors.surfaceGlass,
    borderWidth: 1,
    borderColor: darkThemeColors.borderGlass,
  },
  accent: {
    backgroundColor: darkThemeColors.accent,
  },
  danger: {
    backgroundColor: darkThemeColors.danger,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  default: {
    backgroundColor: darkThemeColors.surface,
  },
  disabled: {
    opacity: 0.45,
  },
  iconText: {
    color: darkThemeColors.textPrimary,
    fontWeight: '600',
  },
  iconText_sm: {
    fontSize: 16,
  },
  iconText_md: {
    fontSize: 18,
  },
  iconText_lg: {
    fontSize: 22,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: darkThemeColors.accent,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: darkThemeColors.background,
  },
  badgeText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '800',
  },
});
