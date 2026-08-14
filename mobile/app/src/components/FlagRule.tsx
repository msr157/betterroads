import { StyleSheet, View } from 'react-native';
import { theme } from '@/theme';

/**
 * Three-stripe flag rule: thin Saffron / White / Green line
 * (mirror of the website's .flag-rule in website/src/index.css)
 */
export function FlagRule({ height = 2, width = 64 }: { height?: number; width?: number | `${number}%` }) {
  return (
    <View style={[styles.container, { height, width }]}>
      <View style={[styles.stripe, { backgroundColor: theme.flagSaffron }]} />
      <View style={[styles.stripe, { backgroundColor: theme.flagWhite }]} />
      <View style={[styles.stripe, { backgroundColor: theme.flagGreen }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 999,
    overflow: 'hidden',
  },
  stripe: {
    flex: 1,
    height: '100%',
  },
});
