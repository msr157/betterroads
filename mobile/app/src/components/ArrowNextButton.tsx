import { Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { theme } from '@/theme';

type Props = {
  onPress: () => void;
  size?: number;
  progressColor?: string;
};

export function ArrowNextButton({
  onPress,
  size = 68,
  progressColor = theme.saffron,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => [
        styles.button,
        { width: size, height: size },
        pressed && styles.pressed,
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 68 68" fill="none">
        {/* Outer Background Ring with warm saffron tint */}
        <Circle
          cx="34"
          cy="34"
          r="33.5"
          stroke="rgba(255, 153, 51, 0.22)"
          strokeWidth={1}
        />

        {/* Progress Arc in warm yellowish-orange saffron */}
        <Path
          d="M34 0.999999C38.3336 0.999998 42.6248 1.85357 46.6286 3.51197C50.6323 5.17038 54.2702 7.60114 57.3345 10.6655C60.3989 13.7298 62.8296 17.3677 64.488 21.3714C66.1464 25.3752 67 29.6664 67 34C67 38.3336 66.1464 42.6248 64.488 46.6286C62.8296 50.6323 60.3989 54.2702 57.3345 57.3345C54.2702 60.3989 50.6323 62.8296 46.6286 64.488C42.6248 66.1464 38.3336 67 34 67C29.6664 67 25.3752 66.1464 21.3714 64.488C17.3677 62.8296 13.7298 60.3989 10.6655 57.3345C7.60114 54.2702 5.17038 50.6323 3.51197 46.6285C1.85357 42.6248 0.999998 38.3336 0.999999 34C0.999999 29.6664 1.85357 25.3752 3.51198 21.3714C5.17038 17.3677 7.60114 13.7298 10.6655 10.6655C13.7298 7.60114 17.3677 5.17038 21.3714 3.51197C25.3752 1.85357 29.6664 0.999998 34 0.999999L34 0.999999Z"
          stroke={progressColor}
          strokeWidth={2.5}
        />

        {/* Center White Circle */}
        <Circle cx="34" cy="34" r="26" fill="#ffffff" />

        {/* Dark Arrow Icon */}
        <Path
          d="M29.375 43.6C29.125 43.35 29 43.054 29 42.712C29 42.3707 29.125 42.075 29.375 41.825L36.7 34.5L29.35 27.15C29.1167 26.9167 29 26.625 29 26.275C29 25.925 29.125 25.625 29.375 25.375C29.625 25.125 29.921 25 30.263 25C30.6043 25 30.9 25.125 31.15 25.375L39.55 33.8C39.65 33.9 39.721 34.0083 39.763 34.125C39.8043 34.2417 39.825 34.3667 39.825 34.5C39.825 34.6333 39.8043 34.7583 39.763 34.875C39.721 34.9917 39.65 35.1 39.55 35.2L31.125 43.625C30.8917 43.8583 30.6043 43.975 30.263 43.975C29.921 43.975 29.625 43.85 29.375 43.6Z"
          fill="#121211"
        />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },
});
