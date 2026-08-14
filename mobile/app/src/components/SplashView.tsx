import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { theme, typography } from '@/theme';
import { FlagRule } from '@/components/FlagRule';

type Props = {
  statusText?: string;
};

export function SplashView({ statusText = 'Initializing...' }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  return (
    <SafeAreaView style={styles.root}>
      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Hindi Eyebrow */}
        <Text style={typography.hindiEyebrow}>गड्डों से आज़ादी</Text>

        {/* Brand Wordmark with Saffron Dot */}
        <View style={styles.brandRow}>
          <Text style={styles.wordmark}>betterroads</Text>
          <Text style={styles.accentDot}>.</Text>
        </View>

        {/* Flag Rule */}
        <View style={styles.flagRuleWrapper}>
          <FlagRule width={48} height={2.5} />
        </View>

        {/* Tagline */}
        <Text style={styles.tagline}>To fix the roads, let's fix the system.</Text>

        {/* Loading Indicator */}
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="small" color={theme.saffronDeep} />
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  wordmark: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1.5,
    color: theme.ink,
  },
  accentDot: {
    fontSize: 42,
    fontWeight: '900',
    color: theme.saffron,
  },
  flagRuleWrapper: {
    marginVertical: 4,
  },
  tagline: {
    fontSize: 15,
    color: theme.ink2,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  loaderContainer: {
    marginTop: 48,
    alignItems: 'center',
    gap: 10,
  },
  statusText: {
    fontSize: 13,
    color: theme.ink3,
    fontWeight: '500',
  },
});
