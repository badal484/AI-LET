import React from 'react';
import { Text, TextProps } from 'react-native';
import { typography, darkThemeColors } from '../../theme/index.js';

export interface TypographyProps extends TextProps {
  variant?: keyof typeof typography;
  color?: string;
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
  children: React.ReactNode;
}

export const Typography: React.FC<TypographyProps> = ({
  variant = 'bodyMedium',
  color = darkThemeColors.textPrimary,
  align = 'left',
  style,
  children,
  ...rest
}) => {
  const textStyle = [typography[variant], { color, textAlign: align }, style];

  return (
    <Text style={textStyle} {...rest}>
      {children}
    </Text>
  );
};
