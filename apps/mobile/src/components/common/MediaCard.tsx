import React, { useState } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { darkThemeColors, spacing, radius } from '../../theme/index.js';
import { Icon } from './Icon.js';

export interface MediaCardProps {
  uri: string;
  aspectRatio?: number;
  caption?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  uri,
  aspectRatio = 1,
  caption,
  onPress,
  style,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.85 : 1}
      onPress={onPress}
      style={[styles.container, { aspectRatio }, style]}
      disabled={!onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={caption || 'Generated companion image'}
    >
      <Image
        source={{ uri }}
        style={styles.image}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
        resizeMode="cover"
      />

      {isLoading && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator color={darkThemeColors.accent} size="small" />
        </View>
      )}

      {hasError && (
        <View style={styles.errorOverlay}>
          <Icon name="warning" size={24} color={darkThemeColors.warning} />
          <Text style={styles.errorText}>Unable to load image</Text>
        </View>
      )}

      {caption && (
        <View style={styles.captionOverlay}>
          <Text style={styles.captionText} numberOfLines={2}>
            {caption}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: darkThemeColors.surfaceElevated,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: darkThemeColors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: darkThemeColors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  errorIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  errorText: {
    fontSize: 12,
    color: darkThemeColors.textMuted,
    textAlign: 'center',
  },
  captionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  captionText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});
