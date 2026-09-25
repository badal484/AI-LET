import React from 'react';
import {
  Modal,
  View,
  Image,
  Text,
  StyleSheet,
  Share,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { darkThemeColors, spacing } from '../../theme/index.js';
import { IconButton } from './IconButton.js';

export interface MediaViewerModalProps {
  visible: boolean;
  uri: string | null;
  caption?: string;
  onClose: () => void;
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
  visible,
  uri,
  caption,
  onClose,
}) => {
  if (!uri) return null;

  const handleShare = async () => {
    try {
      await Share.share({
        url: uri,
        message: caption || 'Check out this generated companion moment!',
      });
    } catch {
      // Ignored
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        {/* Top Controls Bar */}
        <View style={styles.headerBar}>
          <IconButton
            icon="close"
            variant="glass"
            size="sm"
            onPress={onClose}
            accessibilityLabel="Close media viewer"
          />

          <IconButton
            icon="share"
            variant="glass"
            size="sm"
            onPress={handleShare}
            accessibilityLabel="Share image"
          />
        </View>

        {/* Image Display */}
        <View style={styles.imageContainer}>
          <Image source={{ uri }} style={styles.fullscreenImage} resizeMode="contain" />
        </View>

        {/* Caption */}
        {caption ? (
          <View style={styles.captionBox}>
            <Text style={styles.captionText}>{caption}</Text>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    zIndex: 10,
  },
  controlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  captionBox: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  captionText: {
    color: darkThemeColors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
