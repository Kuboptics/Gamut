import { Pressable, StyleSheet, type PressableProps } from 'react-native';

// A Pressable that dims and shrinks slightly on touch. This is the one
// place every button/toggle in the app gets its pressed feedback from,
// so it's consistent everywhere instead of reimplemented per screen.
export function PressableOpacity({ style, ...props }: PressableProps) {
  return (
    <Pressable
      {...props}
      style={(state) => [
        typeof style === 'function' ? style(state) : style,
        state.pressed && styles.pressed,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.55,
    transform: [{ scale: 0.97 }],
  },
});
