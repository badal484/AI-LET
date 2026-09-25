import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TouchableWithoutFeedback,
} from 'react-native';
import { Button } from './Button.js';
import { darkThemeColors, spacing, radius } from '../../theme/index.js';

export interface ModalDialogProps {
  visible: boolean;
  title: string;
  description?: string;
  primaryLabel?: string;
  onPrimaryAction?: () => void;
  primaryVariant?: 'primary' | 'danger' | 'secondary' | 'gold';
  isPrimaryLoading?: boolean;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
  onClose: () => void;
  children?: React.ReactNode;
  style?: ViewStyle;
}

export const ModalDialog: React.FC<ModalDialogProps> = ({
  visible,
  title,
  description,
  primaryLabel,
  onPrimaryAction,
  primaryVariant = 'primary',
  isPrimaryLoading = false,
  secondaryLabel = 'Cancel',
  onSecondaryAction,
  onClose,
  children,
  style,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.dialogCard, style]}>
              <Text style={styles.title}>{title}</Text>
              {description && <Text style={styles.description}>{description}</Text>}

              {children && <View style={styles.content}>{children}</View>}

              <View style={styles.buttonRow}>
                {secondaryLabel && (
                  <Button
                    label={secondaryLabel}
                    variant="secondary"
                    size="md"
                    onPress={onSecondaryAction || onClose}
                    style={styles.actionBtn}
                  />
                )}

                {primaryLabel && onPrimaryAction && (
                  <Button
                    label={primaryLabel}
                    variant={primaryVariant}
                    size="md"
                    isLoading={isPrimaryLoading}
                    onPress={onPrimaryAction}
                    style={styles.actionBtn}
                  />
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: darkThemeColors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: darkThemeColors.textMuted,
    marginBottom: spacing.lg,
  },
  content: {
    marginBottom: spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  actionBtn: {
    minWidth: 90,
  },
});
