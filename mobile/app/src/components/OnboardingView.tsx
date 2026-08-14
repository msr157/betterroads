import { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { radii, theme, typography } from '@/theme';
import { FlagRule } from '@/components/FlagRule';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES = [
  {
    id: 'potholes',
    hindi: 'गड्डों से आज़ादी',
    titlePart1: 'Freedom from ',
    titleHighlight: 'Potholes.',
    tagline: 'To fix the roads, let\'s fix the system.',
    description:
      'Map and score road quality automatically as you commute using your smartphone\'s motion sensors.',
    icon: '🛣️',
  },
  {
    id: 'intelligence',
    hindi: 'सटीक डेटा, पारदर्शी भारत',
    titlePart1: 'Every Ride ',
    titleHighlight: 'Scores.',
    tagline: 'Edge AI detection without distraction.',
    description:
      'Real-time vibration analysis logs potholes, speed breakers, and surface roughness as you ride.',
    icon: '📊',
  },
  {
    id: 'privacy',
    hindi: 'निजता और संप्रभुता',
    titlePart1: '100% Sovereign & ',
    titleHighlight: 'Private.',
    tagline: 'No passwords. No surveillance.',
    description:
      'Anonymous device contributor identity. Your personal details stay private unless you opt into the public leaderboard.',
    icon: '🛡️',
  },
];

type Props = {
  onEnter: () => void;
  onGoogleLogin?: () => void;
  googleAuthEnabled?: boolean;
  loading?: boolean;
  error?: string | null;
};

export function OnboardingView({
  onEnter,
  onGoogleLogin,
  googleAuthEnabled = false,
  loading = false,
  error = null,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index !== activeIndex && index >= 0 && index < SLIDES.length) {
      setActiveIndex(index);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Text style={styles.wordmark}>betterroads</Text>
          <Text style={styles.accentDot}>.</Text>
        </View>
        <Text style={styles.headerEyebrow}>LAUNCHING THIS INDEPENDENCE DAY</Text>
      </View>

      {/* Flag rule stripe */}
      <View style={styles.flagRuleContainer}>
        <FlagRule width="100%" height={2} />
      </View>

      {/* Feature Carousel */}
      <View style={styles.carouselContainer}>
        <FlatList
          data={SLIDES}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              {/* Hindi Badge */}
              <View style={styles.hindiBadge}>
                <Text style={typography.hindiEyebrow}>{item.hindi}</Text>
              </View>

              {/* Monumental Headline */}
              <Text style={styles.headline}>
                {item.titlePart1}
                <Text style={styles.highlightText}>{item.titleHighlight}</Text>
              </Text>

              {/* Tagline */}
              <Text style={styles.slideTagline}>{item.tagline}</Text>

              {/* Visual Card */}
              <View style={styles.featureCard}>
                <Text style={styles.featureIcon}>{item.icon}</Text>
                <Text style={styles.featureDescription}>{item.description}</Text>
              </View>
            </View>
          )}
        />
      </View>

      {/* Pagination Dots */}
      <View style={styles.paginationRow}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === activeIndex ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>

      {/* Independence Day Banner */}
      <View style={styles.bannerCard}>
        <Text style={styles.bannerTitle}>🇮🇳 Join the Citizen Movement 🇮🇳</Text>
        <Text style={styles.bannerSubtitle}>
          Fix India's roads through open, crowdsourced data.
        </Text>
      </View>

      {/* Bottom Actions */}
      <View style={styles.bottomSection}>
        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Primary CTA */}
        <Pressable
          style={styles.primaryButton}
          onPress={onEnter}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonText}>Enter BetterRoads</Text>
          )}
        </Pressable>

        {/* Optional Google Test Sign-in */}
        {googleAuthEnabled && onGoogleLogin && (
          <Pressable
            style={styles.secondaryButton}
            onPress={onGoogleLogin}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>Test Google sign-in</Text>
          </Pressable>
        )}

        <Text style={styles.disclaimerText}>
          We create a private contributor ID and unique username for this
          installation. No password needed.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  wordmark: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
    color: theme.ink,
  },
  accentDot: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.saffron,
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: theme.ink3,
    textTransform: 'uppercase',
  },
  flagRuleContainer: {
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  carouselContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  slide: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hindiBadge: {
    marginBottom: 10,
  },
  headline: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
    color: theme.ink,
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 8,
  },
  highlightText: {
    color: theme.saffronDeep,
  },
  slideTagline: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.ink2,
    textAlign: 'center',
    marginBottom: 20,
  },
  featureCard: {
    width: '100%',
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: radii.xl,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    fontSize: 36,
  },
  featureDescription: {
    fontSize: 14,
    color: theme.ink,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginVertical: 12,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 24,
    backgroundColor: theme.saffronDeep,
  },
  dotInactive: {
    width: 6,
    backgroundColor: theme.lineStrong,
  },
  bannerCard: {
    marginHorizontal: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: theme.bg3,
    borderWidth: 1,
    borderColor: theme.lineStrong,
    borderRadius: radii.md,
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.ink,
  },
  bannerSubtitle: {
    fontSize: 11,
    color: theme.ink2,
    textAlign: 'center',
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 10,
  },
  primaryButton: {
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
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  secondaryButton: {
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.lineStrong,
    borderRadius: radii.full,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: theme.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: theme.danger,
    fontSize: 13,
    textAlign: 'center',
  },
  disclaimerText: {
    fontSize: 11,
    color: theme.ink3,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
  },
});
