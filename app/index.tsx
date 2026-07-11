import { StyleSheet, Text, View } from 'react-native';

// Placeholder home screen. The real "Today" screen (target swatch, hex,
// countdown, difficulty toggle, capture button) gets built in a later step.
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Color Hunt</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 24,
  },
});
