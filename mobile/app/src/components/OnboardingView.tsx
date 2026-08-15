import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
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
import { ArrowNextButton } from '@/components/ArrowNextButton';

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
    progressColor: theme.saffron,
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
    progressColor: theme.saffron,
  },
  {
    id: 'privacy',
    eyebrow: 'SOVEREIGN IDENTITY',
    titlePart1: '100% Sovereign & ',
    titleHighlight: 'Private.',
    tagline: 'No passwords. No surveillance.',
    description:
      'Anonymous device contributor identity. Enable location to automatically map your civic district.',
    iconName: 'shield-checkmark-outline' as const,
    progressColor: theme.saffron,
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
  const isAutoPlayingRef = useRef(true);

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

  const nextSlide = () => {
    if (activeIndex < SLIDES.length - 1) {
      goToSlide(activeIndex + 1);
    } else {
      onEnter();
    }
  };

  // Auto-swipe all onboarding slides every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isAutoPlayingRef.current) return;
      setActiveIndex((prev) => {
        const next = (prev + 1) % SLIDES.length;
        try {
          listRef.current?.scrollToIndex({ index: next, animated: true });
        } catch {}
        return next;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [width]);

  const openSocial = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  const isLastSlide = activeIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.root}>
      {/* Top Header with Wordmark and Top Bar Socials */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Text style={styles.wordmark}>BetterRoads</Text>
        </View>

        {/* Top Bar Social Icons */}
        <View style={styles.socialHeaderRow}>
          {SOCIAL_LINKS.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => openSocial(s.url)}
              hitSlop={10}
              style={styles.socialHeaderButton}
            >
              <Ionicons name={s.iconName} size={20} color={theme.ink2} />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Flag rule stripe */}
      <View style={styles.flagRuleContainer}>
        <FlagRule width="100%" height={2} />
      </View>

      {/* Main Content Area */}
      <View
        style={styles.mainContent}
        onTouchStart={() => {
          isAutoPlayingRef.current = false;
        }}
      >
        {/* Feature Carousel */}
        <View style={styles.carouselWrapper}>
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

                {/* Centered Feature Card */}
                <View style={styles.featureCard}>
                  <View style={styles.iconCircle}>
                    <Ionicons
                      name={item.iconName}
                      size={32}
                      color={theme.saffronLift}
                    />
                  </View>
                  <View style={styles.featureTextWrapper}>
                    <Text style={styles.featureDescription}>
                      {item.description}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          />
        </View>

        {/* Middle Banner: Citizen Movement & Larger Centered Socials */}
        <View style={styles.middleBannerContainer}>
          <View style={styles.bannerCard}>
            <View style={styles.bannerHeaderRow}>
              <FlagRule width={32} height={2} />
              <Text style={styles.bannerTitle}>Join the Citizen Movement</Text>
              <FlagRule width={32} height={2} />
            </View>
            <Text style={styles.bannerSubtitle}>
              Fix India's roads through open, crowdsourced data.
            </Text>

            {/* Larger Centered Social Icons */}
            <View style={styles.largeSocialRow}>
              {SOCIAL_LINKS.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => openSocial(s.url)}
                  style={styles.largeSocialButton}
                >
                  <Ionicons
                    name={s.iconName}
                    size={24}
                    color={theme.saffronLift}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Interactive Pagination Dots */}
        <View style={styles.paginationRow}>
          {SLIDES.map((_, i) => (
            <Pressable
              key={i}
              onPress={() => {
                isAutoPlayingRef.current = false;
                goToSlide(i);
              }}
              hitSlop={12}
              style={[
                styles.dot,
                i === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Bottom Action Area */}
      <View style={styles.bottomSection}>
        {error && <Text style={styles.errorText}>{error}</Text>}

        {!isLastSlide ? (
          /* Saffron Circular Arrow Next Button on Slide 1 & 2 */
          <View style={styles.arrowButtonContainer}>
            <ArrowNextButton
              onPress={() => {
                isAutoPlayingRef.current = false;
                nextSlide();
              }}
              size={68}
              progressColor={theme.saffron}
            />
          </View>
        ) : (
          /* Final CTA on Slide 3 with Location Permission Trigger */
          <View style={styles.finalActionsWrapper}>
            <Pressable
              style={styles.primaryButton}
              onPress={onEnter}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <View style={styles.primaryButtonContent}>
                  <Ionicons
                    name="location-outline"
                    size={20}
                    color="#ffffff"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.primaryButtonText}>
                    Enter & Set Up Profile
                  </Text>
                </View>
              )}
            </Pressable>

            {googleAuthEnabled && onGoogleLogin && (
              <Pressable
                style={styles.secondaryButton}
                onPress={onGoogleLogin}
                disabled={loading}
              >
                <Text style={styles.secondaryButtonText}>
                  Test Google sign-in
                </Text>
              </Pressable>
            )}

            <Text style={styles.disclaimerText}>
              Location permission will automatically detect your city. No
              passwords needed.
            </Text>
          </View>
        )}
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
    paddingTop: 10,
    paddingBottom: 6,
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
  socialHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  socialHeaderButton: {
    padding: 6,
    borderRadius: radii.full,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.line,
  },
  flagRuleContainer: {
    paddingHorizontal: 20,
    marginBottom: 6,
    width: '100%',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'space-around',
    width: '100%',
  },
  carouselWrapper: {
    width: '100%',
  },
  slide: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideEyebrowBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.line,
    marginBottom: 8,
  },
  slideEyebrowText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: theme.saffron,
  },
  headline: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
    color: theme.ink,
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 4,
  },
  highlightText: {
    color: theme.saffronDeep,
  },
  slideTagline: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.ink2,
    textAlign: 'center',
    marginBottom: 12,
    maxWidth: 320,
  },
  featureCard: {
    width: '100%',
    minHeight: 160,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: radii.xl,
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.saffronTint,
    borderWidth: 1,
    borderColor: theme.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  featureDescription: {
    fontSize: 14,
    color: theme.ink,
    textAlign: 'center',
    lineHeight: 21,
    fontWeight: '500',
    maxWidth: 300,
  },
  middleBannerContainer: {
    paddingHorizontal: 16,
    marginVertical: 4,
    width: '100%',
  },
  bannerCard: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.lineStrong,
    borderRadius: radii.xl,
    alignItems: 'center',
    gap: 8,
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.ink,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: theme.ink2,
    textAlign: 'center',
    lineHeight: 16,
  },
  largeSocialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 4,
  },
  largeSocialButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.bg3,
    borderWidth: 1,
    borderColor: theme.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginVertical: 6,
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
  bottomSection: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    alignItems: 'center',
    width: '100%',
  },
  arrowButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  finalActionsWrapper: {
    width: '100%',
    gap: 8,
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
    width: '100%',
  },
  primaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
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
