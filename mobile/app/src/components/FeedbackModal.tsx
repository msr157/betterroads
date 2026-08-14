import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { radii, theme, typography } from '@/theme';
import type { UserProfile } from '@/auth';

const API_FEEDBACK_URL = 'https://betterroads.org/api/public/feedback';

type Props = {
  visible: boolean;
  onClose: () => void;
  user: UserProfile | null;
};

export function FeedbackModal({ visible, onClose, user }: Props) {
  const [category, setCategory] = useState<'Suggestion' | 'Bug Report' | 'General'>('Suggestion');
  const [description, setDescription] = useState('');
  const [captchaNum1, setCaptchaNum1] = useState(Math.floor(Math.random() * 9) + 1);
  const [captchaNum2, setCaptchaNum2] = useState(Math.floor(Math.random() * 9) + 1);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const resetCaptcha = () => {
    setCaptchaNum1(Math.floor(Math.random() * 9) + 1);
    setCaptchaNum2(Math.floor(Math.random() * 9) + 1);
    setCaptchaAnswer('');
  };

  const submit = async () => {
    if (!description.trim()) {
      return Alert.alert('Error', 'Please enter your feedback description.');
    }
    if (parseInt(captchaAnswer, 10) !== captchaNum1 + captchaNum2) {
      return Alert.alert('Error', 'Incorrect math answer. Please try again.');
    }

    setSubmitting(true);
    try {
      const deviceOs = Platform.OS;
      let location = 'Unknown';
      try {
        location = Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        // ignore
      }

      const res = await fetch(API_FEEDBACK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: user?.name || 'Mobile Contributor',
          email: user?.email || undefined,
          category,
          description: description.trim(),
          source: 'mobile',
          deviceOs,
          location,
        }),
      });

      if (!res.ok) throw new Error('Failed to submit feedback.');
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setDescription('');
        resetCaptcha();
        onClose();
      }, 1800);
    } catch {
      Alert.alert('Error', 'Failed to send feedback. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheetContainer}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {/* Sheet Header */}
            <View style={styles.headerRow}>
              <View>
                <Text style={typography.eyebrow}>BETTERROADS CIVIC INITIATIVE</Text>
                <Text style={styles.title}>Send Feedback</Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            </View>

            {success ? (
              <View style={styles.successBox}>
                <Text style={styles.successIcon}>🎉</Text>
                <Text style={styles.successTitle}>Thank you!</Text>
                <Text style={styles.successSubtitle}>
                  Your feedback has been received and will help improve road intelligence for everyone.
                </Text>
              </View>
            ) : (
              <>
                {/* Category Chips */}
                <Text style={styles.fieldLabel}>Category</Text>
                <View style={styles.chipRow}>
                  {(['Suggestion', 'Bug Report', 'General'] as const).map((cat) => {
                    const active = category === cat;
                    return (
                      <Pressable
                        key={cat}
                        onPress={() => setCategory(cat)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {cat}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Description */}
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  multiline
                  numberOfLines={4}
                  placeholder="Tell us what's on your mind or report a bug..."
                  placeholderTextColor={theme.ink3}
                  value={description}
                  onChangeText={setDescription}
                />

                {/* Spam Check */}
                <Text style={styles.fieldLabel}>
                  Spam Check: What is {captchaNum1} + {captchaNum2}?
                </Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="Enter sum"
                  placeholderTextColor={theme.ink3}
                  value={captchaAnswer}
                  onChangeText={setCaptchaAnswer}
                />

                {/* Submit Button */}
                <Pressable
                  style={styles.submitButton}
                  disabled={submitting}
                  onPress={submit}
                >
                  {submitting ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Submit Feedback</Text>
                  )}
                </Pressable>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: theme.bg2,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: theme.lineStrong,
    borderBottomWidth: 0,
    maxHeight: '90%',
  },
  content: {
    padding: 24,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: theme.ink,
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
    borderRadius: radii.full,
    backgroundColor: theme.bg3,
    borderWidth: 1,
    borderColor: theme.line,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: theme.ink2,
    fontSize: 14,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: theme.ink2,
    marginTop: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radii.full,
    backgroundColor: theme.bg3,
    borderWidth: 1,
    borderColor: theme.line,
  },
  chipActive: {
    borderColor: theme.saffronDeep,
    backgroundColor: theme.saffronTint,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.ink2,
  },
  chipTextActive: {
    color: theme.saffronLift,
    fontWeight: '700',
  },
  input: {
    backgroundColor: theme.bg3,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: radii.md,
    color: theme.ink,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: theme.saffronDeep,
    borderRadius: radii.full,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: theme.saffronDeep,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  successBox: {
    paddingVertical: 36,
    alignItems: 'center',
    gap: 8,
  },
  successIcon: {
    fontSize: 40,
    marginBottom: 4,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.ink,
  },
  successSubtitle: {
    fontSize: 14,
    color: theme.ink2,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
});
