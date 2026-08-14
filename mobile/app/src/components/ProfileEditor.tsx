import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { State, City } from 'country-state-city';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { radii, theme, typography } from '@/theme';
import { FlagRule } from '@/components/FlagRule';
import { SearchModalPicker } from '@/components/SearchModalPicker';
import { FeedbackModal } from '@/components/FeedbackModal';
import { GOOGLE_AUTH_ENABLED } from '@/config';
import {
  deleteAccount,
  linkGoogleToken,
  updateProfile,
  type UserProfile,
} from '@/auth';

type Props = {
  user: UserProfile;
  onSaved: (user: UserProfile) => void;
  onDeleted: () => void;
  onCancel: () => void;
  onLogout: () => void;
  isInitialSetup?: boolean;
};

// Strictly 3 gender options requested by user
const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
] as const;

export function ProfileEditor({
  user,
  onSaved,
  onDeleted,
  onCancel,
  onLogout,
  isInitialSetup = false,
}: Props) {
  const [username, setUsername] = useState(user?.username || '');
  const [name, setName] = useState(user?.name || '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth ?? '');
  const [gender, setGender] = useState(user?.gender ?? '');
  const [publicLeaderboard, setPublicLeaderboard] = useState(
    user?.publicLeaderboard ?? false,
  );

  // State & City selection
  const initialParts = (user?.city || '').split(', ');
  const [selectedStateCode, setSelectedStateCode] = useState<string | null>(
    initialParts[1] || null,
  );
  const [selectedCityName, setSelectedCityName] = useState<string | null>(
    initialParts[0] || null,
  );

  const [statePickerOpen, setStatePickerOpen] = useState(false);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const stateItems = State.getStatesOfCountry('IN').map((s) => ({
    label: s.name,
    value: s.isoCode,
  }));

  const cityItems = selectedStateCode
    ? City.getCitiesOfState('IN', selectedStateCode).map((c) => ({
        label: c.name,
        value: c.name,
      }))
    : [];

  const selectedStateName =
    stateItems.find((s) => s.value === selectedStateCode)?.label ?? null;

  // Date picker
  const [showDatePicker, setShowDatePicker] = useState(false);
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - 12);

  const onDateChange = (_: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const yyyy = selectedDate.getFullYear();
      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(selectedDate.getDate()).padStart(2, '0');
      setDateOfBirth(`${yyyy}-${mm}-${dd}`);
    }
  };

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const normalizedUsername = username.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]{2,23}$/.test(normalizedUsername)) {
      return setError(
        'Username must be 3-24 lowercase letters, numbers, or underscores, starting with a letter.',
      );
    }
    if (!name.trim()) {
      return setError('Name is required.');
    }
    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      return setError('Date of birth must be YYYY-MM-DD.');
    }

    setSaving(true);
    setError(null);
    try {
      const finalCity =
        selectedCityName && selectedStateCode
          ? `${selectedCityName}, ${selectedStateCode}`
          : null;

      const updated = await updateProfile({
        username: normalizedUsername,
        name: name.trim(),
        dateOfBirth: dateOfBirth || null,
        gender: gender || null,
        genderSelfDescription: null,
        city: finalCity,
        publicLeaderboard,
      });
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save profile.');
      setSaving(false);
    }
  };

  const handleLinkGoogle = async () => {
    setSaving(true);
    setError(null);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (response.type !== 'success' || !response.data.idToken) {
        setSaving(false);
        return;
      }
      const updated = await linkGoogleToken(response.data.idToken);
      onSaved(updated);
    } catch (e: any) {
      if (e.code !== 'SIGN_IN_CANCELLED') {
        setError(e.message || 'Could not link Google account.');
      }
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete account?',
      'Your profile and contributor credentials will be permanently removed. Anonymous road measurements remain in the public road dataset.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: () => {
            void deleteAccount()
              .then(onDeleted)
              .catch((e) =>
                setError(e instanceof Error ? e.message : 'Could not delete account.'),
              );
          },
        },
      ],
    );
  };

  const initial = (name || user?.name || 'C').trim().charAt(0).toUpperCase() || 'C';

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header with Status Bar Clearance */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={typography.eyebrow}>
                {isInitialSetup ? 'WELCOME TO BETTERROADS' : 'CONTRIBUTOR SETTINGS'}
              </Text>
              <Text style={styles.headerTitle}>
                {isInitialSetup ? 'Complete Profile' : 'Your Profile'}
              </Text>
            </View>
            <Pressable onPress={onCancel} hitSlop={12} style={styles.cancelPill}>
              <Text style={styles.cancelPillText}>
                {isInitialSetup ? 'Skip' : 'Close'}
              </Text>
            </Pressable>
          </View>
          <FlagRule width={48} height={2} />
        </View>

        {/* Contributor Card */}
        <View style={styles.contributorCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.contributorInfo}>
            <Text style={styles.contributorName} numberOfLines={1}>
              {name || 'Contributor'}
            </Text>
            <Text style={styles.contributorUsername} numberOfLines={1}>
              @{username || 'user'}
            </Text>
            <View style={styles.idBadge}>
              <Text style={styles.idBadgeLabel}>ID:</Text>
              <Text
                style={styles.idBadgeValue}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {user?.publicId || 'BR-CONTRIB'}
              </Text>
            </View>
          </View>
        </View>

        {/* Account Details Card */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Account Credentials</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Username *</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="e.g. rahul_m"
              placeholderTextColor={theme.ink3}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Display Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Rahul Sharma"
              placeholderTextColor={theme.ink3}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Google Account</Text>
            <View style={[styles.input, styles.inputDisabled]}>
              <Text style={styles.disabledInputText}>
                {user?.email ?? 'Not linked'}
              </Text>
            </View>
          </View>

          {GOOGLE_AUTH_ENABLED && !user?.googleLinked && (
            <Pressable
              style={styles.linkGoogleButton}
              disabled={saving}
              onPress={handleLinkGoogle}
            >
              <Text style={styles.linkGoogleButtonText}>
                Link Google Account (Test)
              </Text>
            </Pressable>
          )}
        </View>

        {/* Demographics Card */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Personal Information</Text>

          {/* Date of Birth */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Date of Birth (Must be 12+)</Text>
            <Pressable onPress={() => setShowDatePicker(true)}>
              <View style={styles.selectTrigger}>
                <Text
                  style={[
                    styles.selectTriggerText,
                    !dateOfBirth && styles.placeholderText,
                  ]}
                >
                  {dateOfBirth || 'Select Date of Birth'}
                </Text>
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={theme.ink2}
                />
              </View>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={dateOfBirth ? new Date(dateOfBirth) : maxDate}
                mode="date"
                display="default"
                maximumDate={maxDate}
                onChange={onDateChange}
              />
            )}
          </View>

          {/* Gender — strictly 3 options */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Gender (Optional)</Text>
            <View style={styles.genderRow}>
              {GENDER_OPTIONS.map((g) => {
                const isSelected = gender === g.value;
                return (
                  <Pressable
                    key={g.value}
                    onPress={() => setGender(isSelected ? '' : g.value)}
                    style={[
                      styles.genderChip,
                      isSelected && styles.genderChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.genderChipText,
                        isSelected && styles.genderChipTextSelected,
                      ]}
                    >
                      {g.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* State Picker */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>State / UT</Text>
            <Pressable onPress={() => setStatePickerOpen(true)}>
              <View style={styles.selectTrigger}>
                <Text
                  style={[
                    styles.selectTriggerText,
                    !selectedStateName && styles.placeholderText,
                  ]}
                >
                  {selectedStateName || 'Select State'}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={theme.ink3}
                />
              </View>
            </Pressable>
          </View>

          {/* City Picker */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>City / Town</Text>
            <Pressable
              onPress={() => {
                if (!selectedStateCode) {
                  Alert.alert('Select State First', 'Please select your state before choosing a city.');
                  return;
                }
                setCityPickerOpen(true);
              }}
            >
              <View
                style={[
                  styles.selectTrigger,
                  !selectedStateCode && styles.selectTriggerDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.selectTriggerText,
                    !selectedCityName && styles.placeholderText,
                  ]}
                >
                  {selectedCityName ||
                    (selectedStateCode ? 'Select City' : 'Select state first')}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={theme.ink3}
                />
              </View>
            </Pressable>
          </View>
        </View>

        {/* Public Leaderboard Card */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Public Presence</Text>
          <Pressable
            style={styles.consentRow}
            onPress={() => setPublicLeaderboard((v) => !v)}
          >
            <View
              style={[
                styles.checkbox,
                publicLeaderboard && styles.checkboxActive,
              ]}
            >
              {publicLeaderboard && (
                <Ionicons name="checkmark" size={14} color="#ffffff" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.consentTitle}>
                Show contribution totals on public leaderboard
              </Text>
              <Text style={styles.consentDescription}>
                If enabled, your display name and kilometers mapped will appear on the public website ranking.
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Error message */}
        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <Pressable
            style={styles.saveButton}
            disabled={saving}
            onPress={handleSave}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>
                {isInitialSetup ? 'Save & Start Exploring' : 'Save Profile'}
              </Text>
            )}
          </Pressable>

          {!isInitialSetup && (
            <Pressable
              style={styles.feedbackButton}
              onPress={() => setFeedbackOpen(true)}
            >
              <Text style={styles.feedbackButtonText}>Send Feedback / Bug Report</Text>
            </Pressable>
          )}

          {!isInitialSetup && (
            <View style={styles.footerLinks}>
              <Pressable onPress={onLogout} style={styles.footerLinkButton}>
                <Text style={styles.logoutText}>Log Out</Text>
              </Pressable>

              <Text style={styles.footerSeparator}>•</Text>

              <Pressable onPress={confirmDelete} style={styles.footerLinkButton}>
                <Text style={styles.deleteText}>Delete Account</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Modals */}
        <SearchModalPicker
          visible={statePickerOpen}
          title="Select State / UT"
          searchPlaceholder="Search state or territory..."
          items={stateItems}
          selectedValue={selectedStateCode}
          onSelect={(code) => {
            setSelectedStateCode(code);
            setSelectedCityName(null);
          }}
          onClose={() => setStatePickerOpen(false)}
        />

        <SearchModalPicker
          visible={cityPickerOpen}
          title="Select City / District"
          searchPlaceholder="Search city in selected state..."
          items={cityItems}
          selectedValue={selectedCityName}
          onSelect={(name) => setSelectedCityName(name)}
          onClose={() => setCityPickerOpen(false)}
        />

        <FeedbackModal
          visible={feedbackOpen}
          onClose={() => setFeedbackOpen(false)}
          user={user}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  scrollContainer: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 12,
    paddingBottom: 40,
    gap: 14,
    width: '100%',
  },
  header: {
    gap: 6,
    marginBottom: 4,
    width: '100%',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: theme.ink,
    marginTop: 2,
  },
  cancelPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: theme.bg3,
    borderWidth: 1,
    borderColor: theme.line,
  },
  cancelPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.ink2,
  },
  contributorCard: {
    width: '100%',
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: radii.xl,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.saffronTint,
    borderWidth: 1.5,
    borderColor: theme.saffronDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.saffronLift,
  },
  contributorInfo: {
    flex: 1,
    gap: 2,
  },
  contributorName: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.ink,
  },
  contributorUsername: {
    fontSize: 13,
    color: theme.ink2,
    fontWeight: '600',
  },
  idBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  idBadgeLabel: {
    fontSize: 11,
    color: theme.ink3,
    fontWeight: '700',
  },
  idBadgeValue: {
    fontSize: 11,
    color: theme.ink2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flexShrink: 1,
  },
  sectionCard: {
    width: '100%',
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: radii.lg,
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: theme.saffron,
    marginBottom: 2,
  },
  fieldGroup: {
    gap: 6,
    width: '100%',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.ink2,
  },
  input: {
    width: '100%',
    backgroundColor: theme.bg3,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: radii.md,
    color: theme.ink,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  inputDisabled: {
    backgroundColor: theme.bg,
    borderColor: theme.line,
  },
  disabledInputText: {
    color: theme.ink3,
    fontSize: 14,
  },
  linkGoogleButton: {
    width: '100%',
    borderWidth: 1,
    borderColor: theme.lineStrong,
    backgroundColor: theme.bg3,
    borderRadius: radii.full,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  linkGoogleButtonText: {
    color: theme.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  selectTrigger: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.bg3,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  selectTriggerDisabled: {
    opacity: 0.45,
  },
  selectTriggerText: {
    fontSize: 15,
    color: theme.ink,
    fontWeight: '500',
  },
  placeholderText: {
    color: theme.ink3,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  genderChip: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderRadius: radii.md,
    backgroundColor: theme.bg3,
    borderWidth: 1,
    borderColor: theme.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderChipSelected: {
    borderColor: theme.saffronDeep,
    backgroundColor: theme.saffronTint,
  },
  genderChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.ink2,
    textAlign: 'center',
  },
  genderChipTextSelected: {
    color: theme.saffronLift,
    fontWeight: '800',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    width: '100%',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: theme.lineStrong,
    backgroundColor: theme.bg3,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: theme.saffronDeep,
    borderColor: theme.saffronDeep,
  },
  consentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.ink,
    lineHeight: 18,
  },
  consentDescription: {
    fontSize: 12,
    color: theme.ink3,
    lineHeight: 16,
    marginTop: 4,
  },
  errorText: {
    color: theme.danger,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  actionsContainer: {
    gap: 12,
    marginTop: 4,
    width: '100%',
  },
  saveButton: {
    width: '100%',
    backgroundColor: theme.saffronDeep,
    borderRadius: radii.full,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.saffronDeep,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  feedbackButton: {
    width: '100%',
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.lineStrong,
    borderRadius: radii.full,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackButtonText: {
    color: theme.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 4,
  },
  footerLinkButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  footerSeparator: {
    color: theme.lineStrong,
    fontSize: 14,
  },
  logoutText: {
    color: theme.saffronLift,
    fontSize: 14,
    fontWeight: '700',
  },
  deleteText: {
    color: theme.danger,
    fontSize: 14,
    fontWeight: '700',
  },
});
