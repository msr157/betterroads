import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { radii, theme, typography } from '@/theme';
import { FlagRule } from '@/components/FlagRule';
import { VEHICLES } from '@/vehicles';
import type { VehicleType } from '@/types';
import type { EngineSnapshot } from '@/sensorEngine';
import type { UserProfile } from '@/auth';

const VEHICLE_ICONS: Record<VehicleType, string> = {
  CAR: '🚗',
  BIKE: '🏍️',
  AUTO_RICKSHAW: '🛺',
  BUS: '🚌',
  TRUCK: '🚚',
  OTHER: '🚙',
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
  // Pulsing dot animation for live recording
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (recording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
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

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Top App Bar */}
        <View style={styles.topBar}>
          <View>
            <View style={styles.brandRow}>
              <Text style={styles.wordmark}>betterroads</Text>
              <Text style={styles.accentDot}>.</Text>
            </View>
            <Text style={styles.topEyebrow}>A CITIZEN MOVEMENT FOR INDIA'S ROADS</Text>
          </View>

          {/* Profile Pill */}
          <Pressable
            disabled={recording}
            onPress={onOpenProfile}
            style={[styles.profilePill, recording && { opacity: 0.5 }]}
          >
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {user.name.charAt(0).toUpperCase() || 'C'}
              </Text>
            </View>
            <View style={styles.profileMeta}>
              <Text style={styles.profileName} numberOfLines={1}>
                {user.name}
              </Text>
              <Text style={styles.profileAction}>Profile ⚙</Text>
            </View>
          </Pressable>
        </View>

        {/* Flag Rule */}
        <View style={styles.flagContainer}>
          <FlagRule width="100%" height={2} />
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={typography.hindiEyebrow}>गड्डों से आज़ादी</Text>
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
              <Text style={styles.vehicleActiveTag}>
                {VEHICLE_ICONS[vehicle]} {vehicle}
              </Text>
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

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>LIVE RQI</Text>
                <Text style={[styles.metricValue, { color: rqiColor }]}>
                  {liveRqi}
                  <Text style={styles.metricUnit}> / 100</Text>
                </Text>
              </View>

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
                <Text style={styles.warningIcon}>⚠️</Text>
                <Text style={styles.warningText}>
                  Phone looks unmounted — fix it firmly to a dashboard or holder so readings remain accurate.
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
                    <Text style={styles.vehicleIcon}>
                      {VEHICLE_ICONS[v.type] || '🚗'}
                    </Text>
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
              <Text style={styles.pendingText}>
                🔄 {pendingCount} journey{pendingCount === 1 ? '' : 's'} queued for upload
              </Text>
            </View>
          )}
        </View>

        {/* Info & Instructions Card */}
        {!recording && (
          <View style={styles.instructionsCard}>
            <Text style={styles.instructionsTitle}>How to Record</Text>
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
                Tap End Journey when you arrive. Your trip is scored and uploaded automatically.
              </Text>
            </View>
          </View>
        )}

        {/* Footer info & feedback */}
        <View style={styles.footerSection}>
          <Pressable
            style={styles.feedbackLink}
            onPress={onOpenFeedback}
          >
            <Text style={styles.feedbackLinkText}>💬 Send App Feedback</Text>
          </Pressable>

          <Text style={styles.footerFootnote}>
            Recording runs while the app is active in the foreground. Road quality data is published anonymously to the BetterRoads public map.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  scroll: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  accentDot: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.saffron,
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
    maxWidth: 90,
  },
  profileName: {
    color: theme.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  profileAction: {
    color: theme.ink3,
    fontSize: 10,
    fontWeight: '600',
  },
  flagContainer: {
    marginVertical: 2,
  },
  heroSection: {
    gap: 4,
    marginVertical: 4,
  },
  heroHeadline: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.8,
    color: theme.ink,
    lineHeight: 32,
  },
  hudCard: {
    backgroundColor: theme.bg2,
    borderWidth: 1.5,
    borderColor: theme.lineStrong,
    borderRadius: radii.xl,
    padding: 18,
    gap: 14,
  },
  hudHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
    paddingBottom: 12,
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
  vehicleActiveTag: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.ink2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
  warningIcon: {
    fontSize: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: theme.warn,
    lineHeight: 17,
    fontWeight: '500',
  },
  vehicleSection: {
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: radii.xl,
    padding: 18,
    gap: 12,
  },
  sectionHeaderRow: {
    gap: 2,
  },
  sectionTitle: {
    fontSize: 14,
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
  },
  vehicleCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: theme.bg3,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  vehicleCardActive: {
    borderColor: theme.saffronDeep,
    backgroundColor: theme.saffronTint,
  },
  vehicleIcon: {
    fontSize: 24,
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
  },
  mainCtaButton: {
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
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: radii.lg,
    padding: 16,
    gap: 10,
  },
  instructionsTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.ink2,
    marginBottom: 4,
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
    marginTop: 8,
  },
  feedbackLink: {
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
});
