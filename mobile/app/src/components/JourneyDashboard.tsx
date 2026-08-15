import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { radii, theme, typography } from '@/theme';
import { FlagRule } from '@/components/FlagRule';
import { VEHICLES } from '@/vehicles';
import type { VehicleType } from '@/types';
import type { EngineSnapshot } from '@/sensorEngine';
import type { UserProfile } from '@/auth';

const SOCIAL_LINKS = [
  {
    id: 'instagram',
    label: 'Instagram',
    iconName: 'logo-instagram' as const,
    url: 'https://www.instagram.com/betterroads_org/',
  },
  {
    id: 'x',
    label: 'X',
    iconName: 'logo-twitter' as const,
    url: 'https://x.com/BetterRoadz',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    iconName: 'logo-linkedin' as const,
    url: 'https://www.linkedin.com/company/betterroads',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    iconName: 'logo-youtube' as const,
    url: 'https://www.youtube.com/@BetterRoadsOrg',
  },
];

const VEHICLE_ICONS: Record<
  VehicleType,
  keyof typeof MaterialCommunityIcons.glyphMap
> = {
  CAR: 'car-side',
  BIKE: 'motorbike',
  AUTO_RICKSHAW: 'rickshaw',
  BUS: 'bus-side',
  TRUCK: 'truck-outline',
  OTHER: 'car-multiple',
};

type Props = {
  user: UserProfile;
  vehicle: VehicleType;
  onSelectVehicle: (v: VehicleType) => void;
  recording: boolean;
  uploading: boolean;
  snapshot: EngineSnapshot | null;
  pendingCount: number;
  message: string | null;
  onStartJourney: () => void;
  onStopJourney: () => void;
  onOpenProfile: () => void;
  onOpenFeedback: () => void;
};

export function JourneyDashboard({
  user,
  vehicle,
  onSelectVehicle,
  recording,
  uploading,
  snapshot,
  pendingCount,
  message,
  onStartJourney,
  onStopJourney,
  onOpenProfile,
  onOpenFeedback,
}: Props) {
  const [rqiInfoOpen, setRqiInfoOpen] = useState(false);

  // Pulsing dot animation for live recording
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (recording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 700,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [recording, pulseAnim]);

  const liveRqi = Math.round(snapshot?.liveSegmentRqi ?? 100);
  const rqiColor =
    liveRqi >= 75 ? theme.green : liveRqi >= 45 ? theme.warn : theme.danger;

  const displayName = user?.name || 'Contributor';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'C';

  const openSocial = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top App Bar with Status Bar Clearance */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <View style={styles.brandRow}>
              <Text style={styles.wordmark}>BetterRoads</Text>
            </View>
            <Text style={styles.topEyebrow}>
              CITIZEN MOVEMENT FOR INDIA'S ROADS
            </Text>
          </View>

          {/* Profile Pill */}
          <Pressable
            disabled={recording}
            onPress={onOpenProfile}
            style={[styles.profilePill, recording && { opacity: 0.5 }]}
          >
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{initial}</Text>
            </View>
            <View style={styles.profileMeta}>
              <Text style={styles.profileName} numberOfLines={1}>
                {displayName}
              </Text>
              <View style={styles.profileActionRow}>
                <Text style={styles.profileAction}>Profile</Text>
                <Ionicons
                  name="settings-outline"
                  size={11}
                  color={theme.ink3}
                />
              </View>
            </View>
          </Pressable>
        </View>

        {/* Flag Rule */}
        <View style={styles.flagContainer}>
          <FlagRule width="100%" height={2} />
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={typography.eyebrow}>ROAD QUALITY SENSING</Text>
          <Text style={styles.heroHeadline}>
            Every ride scores the{' '}
            <Text style={{ color: theme.saffronDeep }}>Road.</Text>
          </Text>
        </View>

        {/* Live HUD (when recording) */}
        {recording ? (
          <View style={styles.hudCard}>
            {/* Live Status Header */}
            <View style={styles.hudHeader}>
              <View style={styles.recordingBadge}>
                <Animated.View
                  style={[styles.recordingDot, { opacity: pulseAnim }]}
                />
                <Text style={styles.recordingText}>RECORDING LIVE</Text>
              </View>
              <View style={styles.vehicleTagRow}>
                <MaterialCommunityIcons
                  name={VEHICLE_ICONS[vehicle]}
                  size={16}
                  color={theme.ink2}
                />
                <Text style={styles.vehicleActiveTag}>{vehicle}</Text>
              </View>
            </View>

            {/* Metrics Grid */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>DISTANCE</Text>
                <Text style={styles.metricValue}>
                  {((snapshot?.distanceM ?? 0) / 1000).toFixed(2)}
                  <Text style={styles.metricUnit}> km</Text>
                </Text>
              </View>

              <Pressable
                style={styles.metricCard}
                onPress={() => setRqiInfoOpen(true)}
              >
                <View style={styles.metricLabelRow}>
                  <Text style={styles.metricLabel}>LIVE RQI</Text>
                  <Ionicons
                    name="information-circle-outline"
                    size={13}
                    color={theme.ink3}
                  />
                </View>
                <Text style={[styles.metricValue, { color: rqiColor }]}>
                  {liveRqi}
                  <Text style={styles.metricUnit}> / 100</Text>
                </Text>
              </Pressable>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>EVENTS LOGGED</Text>
                <Text style={styles.metricValue}>
                  {snapshot?.eventCount ?? 0}
                </Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>SEGMENTS</Text>
                <Text style={styles.metricValue}>
                  {snapshot?.segmentCount ?? 0}
                </Text>
              </View>
            </View>

            {/* Mount Stability Alert */}
            {snapshot && !snapshot.isStableMount && (
              <View style={styles.warningBox}>
                <Ionicons name="warning-outline" size={18} color={theme.warn} />
                <Text style={styles.warningText}>
                  Phone looks unmounted — fix it firmly to a dashboard or holder
                  so readings remain accurate.
                </Text>
              </View>
            )}
          </View>
        ) : (
          /* Vehicle Selection Card */
          <View style={styles.vehicleSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Select Your Vehicle</Text>
              <Text style={styles.sectionSubtitle}>
                Calibrates sensor vibration floor
              </Text>
            </View>

            <View style={styles.vehicleGrid}>
              {VEHICLES.map((v) => {
                const isSelected = vehicle === v.type;
                const iconName = VEHICLE_ICONS[v.type];
                return (
                  <Pressable
                    key={v.type}
                    disabled={recording}
                    onPress={() => onSelectVehicle(v.type)}
                    style={[
                      styles.vehicleCard,
                      isSelected && styles.vehicleCardActive,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={iconName}
                      size={26}
                      color={isSelected ? theme.saffronLift : theme.ink2}
                    />
                    <Text
                      style={[
                        styles.vehicleLabel,
                        isSelected && styles.vehicleLabelActive,
                      ]}
                    >
                      {v.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Primary Start / Stop CTA */}
        <View style={styles.ctaSection}>
          <Pressable
            onPress={recording ? onStopJourney : onStartJourney}
            disabled={uploading}
            style={[
              styles.mainCtaButton,
              recording && styles.stopCtaButton,
              uploading && { opacity: 0.7 },
            ]}
          >
            {uploading ? (
              <View style={styles.buttonLoaderRow}>
                <ActivityIndicator color="#ffffff" />
                <Text style={styles.mainCtaText}>Processing upload...</Text>
              </View>
            ) : (
              <Text style={styles.mainCtaText}>
                {recording ? 'End Journey & Save' : 'Start Journey'}
              </Text>
            )}
          </Pressable>

          {/* Upload Status / Message */}
          {message && (
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>{message}</Text>
            </View>
          )}

          {/* Pending uploads banner */}
          {pendingCount > 0 && (
            <View style={styles.pendingBadge}>
              <Ionicons
                name="cloud-upload-outline"
                size={14}
                color={theme.ink2}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.pendingText}>
                {pendingCount} journey{pendingCount === 1 ? '' : 's'} queued for
                upload
              </Text>
            </View>
          )}
        </View>

        {/* Info & Instructions Card */}
        {!recording && (
          <View style={styles.instructionsCard}>
            <View style={styles.instructionsHeaderRow}>
              <Text style={styles.instructionsTitle}>How to Record</Text>
              <Pressable
                onPress={() => setRqiInfoOpen(true)}
                style={styles.rqiPillButton}
              >
                <Ionicons
                  name="speedometer-outline"
                  size={13}
                  color={theme.saffronLift}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.rqiPillText}>RQI Calculator Info</Text>
              </Pressable>
            </View>
            <View style={styles.instructionStep}>
              <Text style={styles.stepNum}>1</Text>
              <Text style={styles.stepText}>
                Mount your phone firmly on a car dashboard or handlebar holder.
              </Text>
            </View>
            <View style={styles.instructionStep}>
              <Text style={styles.stepNum}>2</Text>
              <Text style={styles.stepText}>
                Tap Start Journey and keep the app open while commuting.
              </Text>
            </View>
            <View style={styles.instructionStep}>
              <Text style={styles.stepNum}>3</Text>
              <Text style={styles.stepText}>
                Tap End Journey when you arrive. Your trip is scored and
                uploaded automatically.
              </Text>
            </View>
          </View>
        )}

        {/* Footer info & feedback */}
        <View style={styles.footerSection}>
          <Pressable style={styles.feedbackLink} onPress={onOpenFeedback}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={15}
              color={theme.saffronLift}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.feedbackLinkText}>Send App Feedback</Text>
          </Pressable>

          <Text style={styles.footerFootnote}>
            Recording runs while the app is active in the foreground. Road
            quality data is published anonymously to the BetterRoads public map.
          </Text>

          {/* Social Channels in Dashboard Footer */}
          <View style={styles.dashboardSocialCard}>
            <Text style={styles.dashboardSocialTitle}>
              Connect with BetterRoads
            </Text>
            <View style={styles.dashboardSocialRow}>
              {SOCIAL_LINKS.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => openSocial(s.url)}
                  style={styles.dashboardSocialButton}
                >
                  <Ionicons
                    name={s.iconName}
                    size={22}
                    color={theme.saffronLift}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* RQI Road Quality Calculator Modal */}
        <Modal
          visible={rqiInfoOpen}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setRqiInfoOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <SafeAreaView style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.eyebrow}>CALIBRATION & METRICS</Text>
                  <Text style={styles.modalTitle}>
                    Road Quality Index (RQI)
                  </Text>
                </View>
                <Pressable
                  onPress={() => setRqiInfoOpen(false)}
                  hitSlop={12}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={18} color={theme.ink2} />
                </Pressable>
              </View>

              <ScrollView
                style={{ width: '100%' }}
                contentContainerStyle={styles.modalContent}
              >
                <View style={styles.rqiScoreBreakdown}>
                  <View
                    style={[
                      styles.scoreBadge,
                      { backgroundColor: 'rgba(27, 122, 67, 0.15)' },
                    ]}
                  >
                    <Text
                      style={[styles.scoreBadgeNum, { color: theme.green }]}
                    >
                      75 - 100
                    </Text>
                    <Text style={styles.scoreBadgeLabel}>Smooth / Good</Text>
                  </View>
                  <View
                    style={[
                      styles.scoreBadge,
                      { backgroundColor: 'rgba(250, 178, 25, 0.15)' },
                    ]}
                  >
                    <Text
                      style={[styles.scoreBadgeNum, { color: theme.warn }]}
                    >
                      45 - 74
                    </Text>
                    <Text style={styles.scoreBadgeLabel}>Moderate Roughness</Text>
                  </View>
                  <View
                    style={[
                      styles.scoreBadge,
                      { backgroundColor: 'rgba(208, 59, 59, 0.15)' },
                    ]}
                  >
                    <Text
                      style={[styles.scoreBadgeNum, { color: theme.danger }]}
                    >
                      0 - 44
                    </Text>
                    <Text style={styles.scoreBadgeLabel}>Severe Potholes</Text>
                  </View>
                </View>

                <View style={styles.infoCard}>
                  <Text style={styles.infoCardHeading}>
                    How RQI is Computed
                  </Text>
                  <Text style={styles.infoCardBody}>
                    BetterRoads samples 3-axis accelerometer and gyroscope
                    signals at ~50 Hz. It applies a 0.5–10 Hz bandpass filter to
                    isolate road impacts from vehicle engine baseline.
                  </Text>
                  <Text style={styles.infoCardBody}>
                    Sudden z-axis spikes indicate potholes and speed bumps,
                    penalizing the segment score. Baseline RMS roughness
                    accounts for surface deterioration.
                  </Text>
                </View>

                <Pressable
                  style={styles.closeModalButton}
                  onPress={() => setRqiInfoOpen(false)}
                >
                  <Text style={styles.closeModalButtonText}>Got it</Text>
                </Pressable>
              </ScrollView>
            </SafeAreaView>
          </View>
        </Modal>
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
    paddingBottom: 36,
    gap: 14,
    width: '100%',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  wordmark: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.8,
    color: theme.ink,
  },
  topEyebrow: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: theme.ink3,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.lineStrong,
    borderRadius: radii.full,
    paddingVertical: 5,
    paddingHorizontal: 10,
    gap: 8,
    maxWidth: 160,
  },
  profileAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.saffronTint,
    borderWidth: 1,
    borderColor: theme.saffronDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    color: theme.saffronLift,
    fontWeight: '800',
    fontSize: 13,
  },
  profileMeta: {
    flexShrink: 1,
  },
  profileName: {
    color: theme.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  profileActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  profileAction: {
    color: theme.ink3,
    fontSize: 10,
    fontWeight: '600',
  },
  flagContainer: {
    marginVertical: 2,
    width: '100%',
  },
  heroSection: {
    gap: 4,
    marginVertical: 2,
    width: '100%',
  },
  heroHeadline: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.8,
    color: theme.ink,
    lineHeight: 32,
  },
  hudCard: {
    width: '100%',
    backgroundColor: theme.bg2,
    borderWidth: 1.5,
    borderColor: theme.lineStrong,
    borderRadius: radii.xl,
    padding: 16,
    gap: 14,
  },
  hudHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
    paddingBottom: 10,
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.danger,
  },
  recordingText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: theme.danger,
  },
  vehicleTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vehicleActiveTag: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.ink2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    width: '100%',
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: theme.bg3,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 12,
    gap: 4,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: theme.ink3,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.ink,
    letterSpacing: -0.5,
  },
  metricUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.ink3,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(250, 178, 25, 0.12)',
    borderWidth: 1,
    borderColor: theme.warn,
    borderRadius: radii.md,
    padding: 12,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: theme.warn,
    lineHeight: 17,
    fontWeight: '500',
  },
  vehicleSection: {
    width: '100%',
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: radii.xl,
    padding: 16,
    gap: 12,
  },
  sectionHeaderRow: {
    gap: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.saffron,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: theme.ink3,
  },
  vehicleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
  },
  vehicleCard: {
    flex: 1,
    minWidth: '29%',
    backgroundColor: theme.bg3,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 6,
  },
  vehicleCardActive: {
    borderColor: theme.saffronDeep,
    backgroundColor: theme.saffronTint,
  },
  vehicleLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.ink2,
    textAlign: 'center',
  },
  vehicleLabelActive: {
    color: theme.saffronLift,
    fontWeight: '800',
  },
  ctaSection: {
    gap: 10,
    marginTop: 4,
    width: '100%',
  },
  mainCtaButton: {
    width: '100%',
    backgroundColor: theme.saffronDeep,
    borderRadius: radii.full,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.saffronDeep,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  stopCtaButton: {
    backgroundColor: theme.danger,
    shadowColor: theme.danger,
  },
  buttonLoaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mainCtaText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  messageBox: {
    width: '100%',
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: radii.md,
    padding: 12,
  },
  messageText: {
    fontSize: 13,
    color: theme.ink,
    textAlign: 'center',
    lineHeight: 18,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bg3,
    borderWidth: 1,
    borderColor: theme.lineStrong,
    borderRadius: radii.full,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'center',
  },
  pendingText: {
    fontSize: 12,
    color: theme.ink2,
    fontWeight: '600',
  },
  instructionsCard: {
    width: '100%',
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: radii.lg,
    padding: 16,
    gap: 10,
  },
  instructionsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  instructionsTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.ink2,
  },
  rqiPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bg3,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rqiPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.saffronLift,
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.bg3,
    borderWidth: 1,
    borderColor: theme.lineStrong,
    color: theme.saffron,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 18,
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    color: theme.ink2,
    lineHeight: 17,
  },
  footerSection: {
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
    width: '100%',
  },
  feedbackLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  feedbackLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.saffronLift,
  },
  footerFootnote: {
    fontSize: 11,
    color: theme.ink3,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 12,
  },
  dashboardSocialCard: {
    width: '100%',
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: radii.xl,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  dashboardSocialTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.ink2,
  },
  dashboardSocialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  dashboardSocialButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.bg3,
    borderWidth: 1,
    borderColor: theme.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: theme.bg2,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: theme.lineStrong,
    borderBottomWidth: 0,
    maxHeight: '85%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: theme.ink,
    marginTop: 2,
  },
  modalCloseButton: {
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
  modalContent: {
    padding: 20,
    paddingBottom: 32,
    gap: 14,
  },
  rqiScoreBreakdown: {
    gap: 8,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.line,
  },
  scoreBadgeNum: {
    fontSize: 16,
    fontWeight: '900',
  },
  scoreBadgeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.ink,
  },
  infoCard: {
    backgroundColor: theme.bg3,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: radii.lg,
    padding: 16,
    gap: 8,
  },
  infoCardHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.saffronLift,
  },
  infoCardBody: {
    fontSize: 13,
    color: theme.ink2,
    lineHeight: 19,
  },
  closeModalButton: {
    width: '100%',
    backgroundColor: theme.saffronDeep,
    borderRadius: radii.full,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  closeModalButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
