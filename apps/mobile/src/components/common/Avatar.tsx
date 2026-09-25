import React, { useState } from 'react';
import { View, Image, Text, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { darkThemeColors } from '../../theme/index.js';

export interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'huge';
  presence?: 'online' | 'offline' | 'speaking' | 'user_speaking';
  onPress?: () => void;
  style?: ViewStyle;
}

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  name = 'AI',
  size = 'md',
  presence,
  onPress,
  style,
}) => {
  const [imageError, setImageError] = useState(false);

  const dimensionMap = {
    xs: 28,
    sm: 36,
    md: 48,
    lg: 64,
    xl: 80,
    huge: 104,
  };

  const dim = dimensionMap[size];
  const borderRadius = dim / 2;
  const initial = (name || 'A').charAt(0).toUpperCase();

  const getPresenceColor = () => {
    switch (presence) {
      case 'online':
        return darkThemeColors.success;
      case 'speaking':
        return darkThemeColors.speaking;
      case 'user_speaking':
        return darkThemeColors.userSpeaking;
      case 'offline':
        return darkThemeColors.textMuted;
      default:
        return null;
    }
  };

  const presenceColor = getPresenceColor();
  const presenceDotSize = Math.max(8, Math.round(dim * 0.22));

  const Container = onPress ? TouchableOpacity : View;
  const containerProps = onPress
    ? {
        onPress,
        activeOpacity: 0.8,
        accessibilityRole: 'button' as const,
        accessibilityLabel: `${name}'s avatar`,
      }
    : {};

  return (
    <Container
      {...containerProps}
      style={[{ width: dim, height: dim, position: 'relative' }, style]}
    >
      {uri && !imageError ? (
        <Image
          source={{ uri }}
          style={[styles.image, { width: dim, height: dim, borderRadius }]}
          onError={() => setImageError(true)}
          accessibilityLabel={`${name}'s avatar`}
        />
      ) : (
        <View style={[styles.fallback, { width: dim, height: dim, borderRadius }]}>
          <Text style={[styles.initialText, { fontSize: dim * 0.42 }]}>{initial}</Text>
        </View>
      )}

      {presenceColor && (
        <View
          style={[
            styles.presenceDot,
            {
              width: presenceDotSize,
              height: presenceDotSize,
              borderRadius: presenceDotSize / 2,
              backgroundColor: presenceColor,
              bottom: 0,
              right: 0,
            },
          ]}
        />
      )}
    </Container>
  );
};

const styles = StyleSheet.create({
  image: {
    backgroundColor: darkThemeColors.surfaceElevated,
  },
  fallback: {
    backgroundColor: darkThemeColors.accentMuted,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: {
    color: darkThemeColors.accent,
    fontWeight: '700',
  },
  presenceDot: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: darkThemeColors.background,
  },
});
