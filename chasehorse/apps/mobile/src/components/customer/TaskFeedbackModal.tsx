import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { Button, Input } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { mobileApi } from '../../api/restApi';

interface TaskFeedbackModalProps {
  taskId: string | null;
  taskTitle?: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

export const TaskFeedbackModal: React.FC<TaskFeedbackModalProps> = ({
  taskId,
  taskTitle = 'Field Task Verification',
  onClose,
  onSubmitted,
}) => {
  const { user } = useAuth();
  const [overallRating, setOverallRating] = useState(5);
  const [qualityRating, setQualityRating] = useState(5);
  const [punctualityRating, setPunctualityRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!taskId) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await mobileApi.submitTaskFeedback(
        taskId,
        {
          overallRating,
          qualityRating,
          punctualityRating,
          communicationRating: overallRating,
          evidenceClarityRating: qualityRating,
          comment: comment.trim(),
        },
        user?.token,
      );
      Alert.alert('Feedback Recorded', 'Thank you! Your rating has been recorded for the field worker portfolio.');
      onSubmitted?.();
      onClose();
    } catch (err: any) {
      Alert.alert('Submission Error', err.message || 'Could not submit task feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (rating: number, setRating: (r: number) => void) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
            activeOpacity={0.7}
            style={styles.starBtn}
          >
            <Text style={[styles.starIcon, star <= rating ? styles.starActive : styles.starInactive]}>
              ★
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <Modal visible={Boolean(taskId)} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Worker Performance Review</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{taskTitle}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.dimensionLabel}>Overall Execution Quality</Text>
            {renderStars(overallRating, setOverallRating)}

            <Text style={styles.dimensionLabel}>Evidence Photographic Clarity</Text>
            {renderStars(qualityRating, setQualityRating)}

            <Text style={styles.dimensionLabel}>Punctuality & Turnaround Time</Text>
            {renderStars(punctualityRating, setPunctualityRating)}

            <Input
              label="Feedback Remarks (Optional)"
              placeholder="Provide constructive feedback for the field partner..."
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              style={{ marginTop: spacing.md }}
            />

            <Button
              title={submitting ? 'Submitting...' : 'Submit Official Rating'}
              onPress={handleSubmit}
              loading={submitting}
              style={{ marginTop: spacing.lg }}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(21, 21, 21, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: {
    ...typography.titleMedium,
    color: colors.ink,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textDarkMuted,
    marginTop: 2,
  },
  closeBtn: {
    fontSize: 20,
    color: colors.textDarkMuted,
    padding: spacing.xs,
  },
  body: {
    padding: spacing.lg,
  },
  dimensionLabel: {
    ...typography.caption,
    color: colors.textDarkMuted,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  starsRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  starBtn: {
    paddingRight: spacing.sm,
  },
  starIcon: {
    fontSize: 32,
  },
  starActive: {
    color: '#EAB308',
  },
  starInactive: {
    color: colors.borderLight,
  },
});
