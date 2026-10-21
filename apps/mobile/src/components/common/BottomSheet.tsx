import React from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon.js';
import { darkThemeColors, spacing, radius } from '../../theme/index.js';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  children,
  style,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheetContainer, { paddingBottom: Math.max(insets.bottom + spacing.md, spacing.xxl) }, style]}>
              <View style={styles.handleBar} />

              {title && (
                <View style={styles.titleRow}>
                  <Text style={styles.title}>{title}</Text>
                  <TouchableOpacity
                    onPress={onClose}
                    accessibilityLabel="Close sheet"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="close" size={14} color={darkThemeColors.textMuted} />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.content}>{children}</View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: darkThemeColors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: '85%',
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: darkThemeColors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
  },
  closeIcon: {
    fontSize: 16,
    color: darkThemeColors.textMuted,
    fontWeight: '700',
  },
  content: {
    paddingBottom: spacing.md,
  },
});
