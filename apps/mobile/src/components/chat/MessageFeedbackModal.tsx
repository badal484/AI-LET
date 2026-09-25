import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { feedbackApi, SubmitFeedbackParams } from '../../services/api/feedbackApi';
import { Icon } from '../common/Icon';

interface MessageFeedbackModalProps {
  visible: boolean;
  conversationId: string;
  messageId: string;
  /** Pre-selects thumbs up/down when opened from a bubble's rating button. */
  initialScore?: 1 | -1;
  onClose: () => void;
  onSuccess?: () => void;
}

const REASONS: Array<{ label: string; value: SubmitFeedbackParams['reasonCategory'] }> = [
  { label: 'Not Relevant', value: 'not_relevant' },
  { label: 'Incorrect Info', value: 'incorrect' },
  { label: 'Too Verbose', value: 'too_verbose' },
  { label: 'Wrong Personality', value: 'wrong_personality' },
  { label: 'Repetitive', value: 'repetitive' },
  { label: 'Language Issue', value: 'language_issue' },
  { label: 'Other', value: 'other' },
];

export const MessageFeedbackModal: React.FC<MessageFeedbackModalProps> = ({
  visible,
  conversationId,
  messageId,
  initialScore,
  onClose,
  onSuccess,
}) => {
  const [score, setScore] = useState<1 | -1 | null>(initialScore ?? null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setScore(initialScore ?? null);
      setError(null);
    }
  }, [visible, initialScore]);
  const [selectedReason, setSelectedReason] = useState<SubmitFeedbackParams['reasonCategory']>('other');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!score) return;
    setSubmitting(true);
    try {
      await feedbackApi.submitMessageFeedback(conversationId, messageId, {
        rating: score === 1 ? 'THUMBS_UP' : 'THUMBS_DOWN',
        reasonCategory: score === -1 ? selectedReason : undefined,
        feedbackText: comment.trim() || undefined,
      });
      setComment('');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      // Keep the modal open so the user's input is not lost.
      setError(err?.message || 'Could not send feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Rate Response Quality</Text>
          <Text style={styles.subtitle}>Help us improve your AI companion experience.</Text>
          {error && (
            <Text style={styles.subtitle} accessibilityRole="alert">
              {error}
            </Text>
          )}

          {/* Thumbs Up / Down */}
          <View style={styles.scoreRow}>
            <TouchableOpacity
              style={[styles.scoreButton, score === 1 && styles.scoreButtonActivePositive]}
              onPress={() => setScore(1)}
            >
              <Icon
                name="thumbs-up"
                size={22}
                color={score === 1 ? '#10B981' : '#6B7280'}
              />
              <Text style={[styles.scoreText, score === 1 && styles.scoreTextActive]}>Good</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.scoreButton, score === -1 && styles.scoreButtonActiveNegative]}
              onPress={() => setScore(-1)}
            >
              <Icon
                name="thumbs-down"
                size={22}
                color={score === -1 ? '#EF4444' : '#6B7280'}
              />
              <Text style={[styles.scoreText, score === -1 && styles.scoreTextActive]}>Bad</Text>
            </TouchableOpacity>
          </View>

          {/* Reason chips if negative */}
          {score === -1 && (
            <View style={styles.reasonsContainer}>
              <Text style={styles.reasonHeader}>What went wrong?</Text>
              <View style={styles.chipsWrap}>
                {REASONS.map((r) => (
                  <TouchableOpacity
                    key={r.value}
                    style={[styles.chip, selectedReason === r.value && styles.chipActive]}
                    onPress={() => setSelectedReason(r.value)}
                  >
                    <Text style={[styles.chipText, selectedReason === r.value && styles.chipTextActive]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Comment text input */}
          <TextInput
            style={styles.textInput}
            placeholder="Optional comment or suggestions..."
            placeholderTextColor="#9CA3AF"
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={2}
          />

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, (!score || submitting) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!score || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Feedback</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
  },
  scoreButton: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  scoreButtonActivePositive: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  scoreButtonActiveNegative: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  scoreEmoji: {
    fontSize: 24,
  },
  scoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 4,
  },
  scoreTextActive: {
    color: '#111827',
  },
  reasonsContainer: {
    marginBottom: 12,
  },
  reasonHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#8B5CF6',
  },
  chipText: {
    fontSize: 11,
    color: '#4B5563',
  },
  chipTextActive: {
    color: '#6D28D9',
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#111827',
    marginBottom: 16,
    height: 60,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
