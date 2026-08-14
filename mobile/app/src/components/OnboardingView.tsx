import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, theme } from '@/theme';
import { FlagRule } from '@/components/FlagRule';

const SLIDES = [
  {
    id: 'potholes',
    eyebrow: 'AUTOMATIC SENSING',
    titlePart1: 'Freedom from ',
    titleHighlight: 'Potholes.',
    tagline: 'To fix the roads, let\'s fix the system.',
    description:
      'Map and score road quality automatically as you commute using your smartphone\'s motion sensors.',
    iconName: 'analytics-outline' as const,
  },
  {
    id: 'intelligence',
    eyebrow: 'EDGE AI SENSING',
    titlePart1: 'Every Ride ',
    titleHighlight: 'Scores.',
    tagline: 'Precision vibration detection without distraction.',
    description:
      'Real-time vibration analysis logs potholes, speed breakers, and surface roughness as you ride.',
    iconName: 'hardware-chip-outline' as const,
  },
  {
    id: 'privacy',
    eyebrow: 'SOVEREIGN IDENTITY',
    titlePart1: '100% Sovereign & ',
    titleHighlight: 'Private.',
    tagline: 'No passwords. No surveillance.',
    description:
      'Anonymous device contributor identity. Your personal details stay private unless you opt into the public leaderboard.',
    iconName: 'shield-checkmark-outline' as const,
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
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    if (index !== activeIndex && index >= 0 && index < SLIDES.length) {
      setActiveIndex(index);
    }
  };

  const goToSlide = (index: number) => {
    setActiveIndex(index);
    try {
      listRef.current?.scrollToIndex({ index, animated: true });
    } catch {}
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* Top Header with Status Bar Clearance */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Text style={styles.wordmark}>betterroads</Text>
          <Text style={styles.accentDot}>.</Text>
        </View>
        <Text style={styles.headerEyebrow}>CITIZEN MOVEMENT</Text>
      </View>

      {/* Flag rule stripe */}
      <View style={styles.flagRuleContainer}>
        <FlagRule width="100%" height={2} />
      </View>

      {/* Feature Carousel */}
      <View style={styles.carouselContainer}>
        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          renderItem={({ item }) => (
            <View style={[styles.slide, { width }]}>
              {/* Feature Eyebrow */}
              <View style={styles.slideEyebrowBadge}>
                <Text style={styles.slideEyebrowText}>{item.eyebrow}</Text>
              </View>

              {/* Monumental Headline */}
              <Text style={styles.headline}>
                {item.titlePart1}
                <Text style={styles.highlightText}>{item.titleHighlight}</Text>
              </Text>

              {/* Tagline */}
              <Text style={styles.slideTagline}>{item.tagline}</Text>

              {/* Visual Card with Minimal Vector Icon */}
              <View style={styles.featureCard}>
                <View style={styles.iconCircle}>
                  <Ionicons
                    name={item.iconName}
                    size={32}
                    color={theme.saffronLift}
                  />
                </View>
                <Text style={styles.featureDescription}>
                  {item.description}
                </Text>
              </View>
            </View>
          )}
        />
      </View>

      {/* Interactive Pagination Dots */}
      <View style={styles.paginationRow}>
        {SLIDES.map((_, i) => (
          <Pressable
            key={i}
            onPress={() => goToSlide(i)}
            hitSlop={12}
            style={[
              styles.dot,
              i === activeIndex ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>

      {/* Citizen Movement Banner */}
      <View style={styles.bannerCard}>
        <View style={styles.bannerHeaderRow}>
          <FlagRule width={24} height={2} />
          <Text style={styles.bannerTitle}>Join the Citizen Movement</Text>
          <FlagRule width={24} height={2} />
        </View>
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 8 : 0,
    justifyContent: 'space-between',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
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
    letterSpacing: -0.6,
    color: theme.ink,
  },
  accentDot: {
    fontSize: 24,
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
    paddingHorizontal: 20,
    marginBottom: 6,
    width: '100%',
  },
  carouselContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  slide: {
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideEyebrowBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.line,
    marginBottom: 10,
  },
  slideEyebrowText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: theme.saffron,
  },
  headline: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1,
    color: theme.ink,
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 6,
  },
  highlightText: {
    color: theme.saffronDeep,
  },
  slideTagline: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.ink2,
    textAlign: 'center',
    marginBottom: 16,
    maxWidth: 320,
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
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.saffronTint,
    borderWidth: 1,
    borderColor: theme.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureDescription: {
    fontSize: 13,
    color: theme.ink,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
    maxWidth: 300,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
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
    marginHorizontal: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: theme.bg3,
    borderWidth: 1,
    borderColor: theme.lineStrong,
    borderRadius: radii.md,
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 8,
    width: '100%',
  },
  primaryButton: {
    backgroundColor: theme.saffronDeep,
    borderRadius: radii.full,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.saffronDeep,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    width: '100%',
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
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  secondaryButtonText: {
    color: theme.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: theme.danger,
    fontSize: 12,
    textAlign: 'center',
  },
  disclaimerText: {
    fontSize: 11,
    color: theme.ink3,
    textAlign: 'center',
    lineHeight: 15,
  },
});
